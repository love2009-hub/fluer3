import crypto from 'crypto';

export default async function handler(req, res) {
  // Разрешаем только POST-запросы
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Проверяем подпись webhook
    const signature = req.headers['content-signature-sha1'];
    const body = JSON.stringify(req.body);
    
    if (process.env.YOOKASSA_WEBHOOK_SECRET) {
      const hmac = crypto.createHmac('sha1', process.env.YOOKASSA_WEBHOOK_SECRET);
      hmac.update(body);
      const expectedSignature = hmac.digest('hex');
      
      if (signature !== expectedSignature) {
        console.error('Неверная подпись webhook');
        return res.status(403).json({ error: 'Invalid signature' });
      }
    }

    const event = req.body;
    const payment = event.object;
    const orderNumber = payment.metadata?.orderNumber;

    console.log('Webhook получен:', event.type, 'Заказ:', orderNumber);

    // Обработка событий
    switch (event.type) {
      case 'payment.succeeded':
        // Платёж успешно проведён
        console.log(`✅ Заказ ${orderNumber} оплачен! Сумма: ${payment.amount.value} ₽`);
        
        // Здесь можно отправить уведомление в Telegram
        await sendTelegramNotification(`✅ Заказ ${orderNumber} оплачен!\nСумма: ${payment.amount.value} ₽\nID платежа: ${payment.id}`);
        
        break;

      case 'payment.canceled':
        // Платёж отменён
        console.log(`❌ Заказ ${orderNumber} отменён. Причина: ${payment.cancellation_details?.reason}`);
        
        await sendTelegramNotification(`❌ Заказ ${orderNumber} отменён\nПричина: ${payment.cancellation_details?.reason || 'не указана'}`);
        
        break;

      case 'payment.waiting_for_capture':
        // Платёж создан, ожидает подтверждения (если capture: false)
        console.log(`⏳ Заказ ${orderNumber} ожидает подтверждения`);
        break;

      default:
        console.log(`Неизвестное событие: ${event.type}`);
    }

    // Всегда возвращаем 200, иначе ЮKassa будет повторять запрос
    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Ошибка webhook:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Функция отправки уведомления в Telegram
async function sendTelegramNotification(message) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.log('Telegram не настроен, пропускаем уведомление');
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown'
      })
    });
  } catch (error) {
    console.error('Ошибка отправки в Telegram:', error);
  }
}