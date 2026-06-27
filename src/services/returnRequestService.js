const { ReturnRequest, MentorUser, sequelize } = require('../models');
const warehouseService = require('./warehouseService');
const mentorService = require('./mentorService');

async function createReturnRequest({
  mentorTelegramId,
  mentorName,
  supportTelegramId,
  warehouseQuantity,
  coworkingQuantity,
}) {
  const whQty = Number(warehouseQuantity) || 0;
  const cwQty = Number(coworkingQuantity) || 0;
  const total = whQty + cwQty;

  if (total <= 0) {
    throw new Error('Укажите количество для возврата');
  }

  const holdings = await mentorService.getMentorHoldings(mentorTelegramId);
  if (whQty > holdings.warehouse) {
    throw new Error(`У вас только ${holdings.warehouse} ноутов со склада`);
  }
  if (cwQty > holdings.coworking) {
    throw new Error(`У вас только ${holdings.coworking} ноутов с коворкинга`);
  }

  const pending = await ReturnRequest.findOne({
    where: { mentorTelegramId, status: 'pending' },
  });
  if (pending) {
    throw new Error('У вас уже есть активный запрос на возврат');
  }

  return ReturnRequest.create({
    mentorTelegramId,
    mentorName,
    supportTelegramId,
    warehouseQuantity: whQty,
    coworkingQuantity: cwQty,
    status: 'pending',
  });
}

async function broadcastReturnRequest(telegram, request) {
  const parts = [];
  if (request.warehouseQuantity > 0) {
    parts.push(`${request.warehouseQuantity} со склада`);
  }
  if (request.coworkingQuantity > 0) {
    parts.push(`${request.coworkingQuantity} с коворкинга`);
  }

  const text =
    `📥 Возврат ноутбуков\n\n` +
    `👨‍🏫 ${request.mentorName} возвращает:\n` +
    `💻 ${parts.join(' + ')}\n\n` +
    `Примите возврат?`;

  const { Markup } = require('telegraf');
  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Принять', `rr:accept:${request.id}`),
      Markup.button.callback('❌ Отклонить', `rr:reject:${request.id}`),
    ],
  ]);

  const msg = await telegram.sendMessage(request.supportTelegramId, text, keyboard);
  const requestService = require('./requestService');
  await requestService.saveNotification(
    'return_request',
    request.id,
    request.supportTelegramId,
    msg.chat.id,
    msg.message_id
  );
}

async function respondReturnRequest(requestId, supportTelegramId, accept) {
  return sequelize.transaction(async (t) => {
    const request = await ReturnRequest.findByPk(requestId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!request) {
      throw new Error('Запрос не найден');
    }
    if (request.status !== 'pending') {
      throw new Error('Запрос уже обработан');
    }
    if (request.supportTelegramId !== supportTelegramId) {
      throw new Error('Этот возврат не для вас');
    }

    request.status = accept ? 'accepted' : 'rejected';
    request.respondedAt = new Date();
    await request.save({ transaction: t });

    if (!accept) {
      return { request, accepted: false };
    }

    const mentor = await MentorUser.findOne({
      where: { telegramId: request.mentorTelegramId, isActive: true },
      transaction: t,
    });
    if (!mentor) {
      throw new Error('Ментор не найден');
    }

    if (request.warehouseQuantity > 0) {
      mentor.warehouseHoldings -= request.warehouseQuantity;
      if (mentor.warehouseHoldings < 0) {
        throw new Error('Ошибка: недостаточно ноутов у ментора');
      }
      const available = await warehouseService.getSetting('warehouse_available');
      await warehouseService.setSetting(
        'warehouse_available',
        available + request.warehouseQuantity
      );
    }

    if (request.coworkingQuantity > 0) {
      mentor.coworkingHoldings = (mentor.coworkingHoldings || 0) - request.coworkingQuantity;
      if (mentor.coworkingHoldings < 0) {
        throw new Error('Ошибка: недостаточно ноутов у ментора');
      }
      const coworking = await warehouseService.getSetting('coworking_count');
      await warehouseService.setSetting('coworking_count', coworking + request.coworkingQuantity);
    }

    await mentor.save({ transaction: t });

    return { request, accepted: true, mentor };
  });
}

module.exports = {
  createReturnRequest,
  broadcastReturnRequest,
  respondReturnRequest,
};
