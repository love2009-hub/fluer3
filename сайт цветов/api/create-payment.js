import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  // Разрешаем только POST-запросы
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, orderNumber, description, customerEmail } = req.body;

    // Валидация
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Неверная сумма' });
    }

    if (!orderNumber) {
      return res.status(400).json({ error: 'Номер заказа обязателен' });
    }

    // Создаём платёж через API ЮKassa
    const response = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotence-Key': uuidv4(),
        'Authorization': 'Basic ' + Buffer.from(
          `${process.env.YOOKASSA_SHOP_ID}:${process.env.YOOKASSA_SECRET_KEY}`
        ).toString('base64')
      },
      body: JSON.stringify({
        amount: {
          value: amount.toFixed(2),
          currency: 'RUB'
        },
        capture: true, // автоматическое списание
        confirmation: {
          type: 'redirect',
          return_url: `${process.env.SITE_URL || 'https://ваш-домен.vercel.app'}/?payment=success&order=${orderNumber}`
        },
        description: description || `Заказ цветов №${orderNumber}`,
        metadata: {
          orderNumber,
          customerEmail: customerEmail || ''
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('ЮKassa ошибка:', data);
      return res.status(500).json({ error: 'Ошибка создания платежа', details: data });
    }

    // Возвращаем ссылку на оплату
    if (data.confirmation?.confirmation_url) {
      return res.status(200).json({
        paymentUrl: data.confirmation.confirmation_url,
        paymentId: data.id
      });
    } else {
      return res.status(500).json({ error: 'Не удалось получить ссылку на оплату' });
    }

  } catch (error) {
    console.error('Ошибка create-payment:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}