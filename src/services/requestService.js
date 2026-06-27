const { Op } = require('sequelize');
const { LaptopRequest, RequestNotification, MentorUser, sequelize } = require('../models');
const supportService = require('./supportService');
const warehouseService = require('./warehouseService');

async function saveNotification(requestType, requestId, telegramId, chatId, messageId) {
  return RequestNotification.create({
    requestType,
    requestId,
    telegramId,
    chatId,
    messageId,
  });
}

async function deleteNotifications(telegram, requestType, requestId, exceptTelegramId = null) {
  const notifications = await RequestNotification.findAll({
    where: { requestType, requestId },
  });

  for (const n of notifications) {
    if (exceptTelegramId && n.telegramId === exceptTelegramId) continue;
    try {
      await telegram.deleteMessage(n.chatId, n.messageId);
    } catch {
      // message may already be deleted
    }
    await n.destroy();
  }
}

async function broadcastLaptopRequest(telegram, request) {
  const supports = await supportService.listSupports();
  const cabinet = request.groupName ? `\n🚪 Кабинет: ${request.groupName}` : '';
  const text =
    `📢 Запрос ноутбуков\n\n` +
    `👨‍🏫 ${request.mentorName}\n` +
    `💻 Нужно: ${request.quantity} шт.${cabinet}`;

  const { Markup } = require('telegraf');
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('✅ Принять', `lr:accept:${request.id}`)],
  ]);

  for (const support of supports) {
    try {
      const msg = await telegram.sendMessage(support.telegramId, text, keyboard);
      await saveNotification(
        'laptop_request',
        request.id,
        support.telegramId,
        msg.chat.id,
        msg.message_id
      );
    } catch {
      // support may have blocked bot
    }
  }
}

async function createLaptopRequest({ mentorTelegramId, mentorName, groupName, quantity }) {
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error('Введите количество ноутбуков (число больше 0)');
  }

  const pending = await LaptopRequest.findOne({
    where: {
      mentorTelegramId,
      status: { [Op.in]: ['pending', 'accepted'] },
    },
  });
  if (pending) {
    throw new Error('У вас уже есть активный запрос. Дождитесь его выполнения.');
  }

  return LaptopRequest.create({
    mentorTelegramId,
    mentorName,
    groupName: groupName || null,
    quantity: qty,
    status: 'pending',
  });
}

async function acceptLaptopRequest(requestId, supportTelegramId) {
  return sequelize.transaction(async (t) => {
    const request = await LaptopRequest.findByPk(requestId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!request) {
      throw new Error('Запрос не найден');
    }
    if (request.status !== 'pending') {
      throw new Error('Запрос уже принят другим супортом');
    }

    request.status = 'accepted';
    request.acceptedBy = supportTelegramId;
    request.acceptedAt = new Date();
    await request.save({ transaction: t });

    return request;
  });
}

async function fulfillLaptopRequest({
  requestId,
  supportTelegramId,
  warehouseQuantity,
  coworkingQuantity,
}) {
  return sequelize.transaction(async (t) => {
    const request = await LaptopRequest.findByPk(requestId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!request) {
      throw new Error('Запрос не найден');
    }
    if (request.status !== 'accepted') {
      throw new Error('Запрос не принят или уже выполнен');
    }
    if (request.acceptedBy !== supportTelegramId) {
      throw new Error('Этот запрос принял другой супорт');
    }

    const whQty = Number(warehouseQuantity) || 0;
    const cwQty = Number(coworkingQuantity) || 0;
    const total = whQty + cwQty;

    if (total !== request.quantity) {
      throw new Error(`Нужно выдать ровно ${request.quantity} шт. (указано: ${total})`);
    }

    const warehouseAvailable = await warehouseService.getSetting('warehouse_available');
    const coworkingAvailable = await warehouseService.getSetting('coworking_count');

    if (whQty > warehouseAvailable) {
      throw new Error(`На складе только ${warehouseAvailable} ноутов`);
    }
    if (cwQty > coworkingAvailable) {
      throw new Error(`На коворкинге только ${coworkingAvailable} ноутов`);
    }

    const mentor = await MentorUser.findOne({
      where: { telegramId: request.mentorTelegramId, isActive: true },
      transaction: t,
    });
    if (!mentor) {
      throw new Error('Ментор не найден');
    }

    if (whQty > 0) {
      mentor.warehouseHoldings += whQty;
      await warehouseService.setSetting('warehouse_available', warehouseAvailable - whQty);
    }
    if (cwQty > 0) {
      mentor.coworkingHoldings = (mentor.coworkingHoldings || 0) + cwQty;
      await warehouseService.setSetting('coworking_count', coworkingAvailable - cwQty);
    }
    await mentor.save({ transaction: t });

    request.warehouseQuantity = whQty;
    request.coworkingQuantity = cwQty;
    request.status = 'fulfilled';
    request.fulfilledAt = new Date();
    await request.save({ transaction: t });

    return { request, mentor, warehouseQuantity: whQty, coworkingQuantity: cwQty };
  });
}

async function acceptAndFulfillRequest(requestId, supportTelegramId) {
  const request = await acceptLaptopRequest(requestId, supportTelegramId);
  const stats = await warehouseService.getWarehouseStats();

  const whQty = Math.min(request.quantity, stats.available);
  const cwQty = request.quantity - whQty;

  if (cwQty > stats.coworking) {
    throw new Error(
      `Недостаточно ноутов: на складе ${stats.available}, на коворкинге ${stats.coworking}, нужно ${request.quantity}`
    );
  }

  return fulfillLaptopRequest({
    requestId,
    supportTelegramId,
    warehouseQuantity: whQty,
    coworkingQuantity: cwQty,
  });
}

function formatFulfillmentPrompt(request, stats) {
  const group = request.groupName ? ` (${request.groupName})` : '';
  return (
    `✅ Вы приняли запрос\n\n` +
    `👨‍🏫 ${request.mentorName}${group}\n` +
    `💻 Нужно: ${request.quantity} шт.\n\n` +
    `📦 Склад: ${stats.available} доступно\n` +
    `🏢 Коворкинг: ${stats.coworking} доступно\n\n` +
    'Сколько выдать со склада? (остальное — с коворкинга)'
  );
}

module.exports = {
  createLaptopRequest,
  acceptLaptopRequest,
  acceptAndFulfillRequest,
  fulfillLaptopRequest,
  broadcastLaptopRequest,
  deleteNotifications,
  saveNotification,
  formatFulfillmentPrompt,
};
