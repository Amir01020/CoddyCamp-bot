const { canIssueReturn } = require('../middlewares/isAdmin');
const requestService = require('../../services/requestService');
const returnRequestService = require('../../services/returnRequestService');

function notifyMentor(ctx, result) {
  const cabinet = result.request.groupName ? `\n🚪 Кабинет: ${result.request.groupName}` : '';
  let msg = `✅ Супорт выдал вам ${result.request.quantity} ноутов${cabinet}`;
  if (result.warehouseQuantity) msg += `\n📦 Со склада: ${result.warehouseQuantity}`;
  if (result.coworkingQuantity) msg += `\n🏢 С коворкинга: ${result.coworkingQuantity}`;
  ctx.telegram.sendMessage(result.request.mentorTelegramId, msg).catch(() => {});
}

function registerRequestHandlers(bot, canIssueReturnMw) {
  bot.action(/^lr:accept:(\d+)$/, canIssueReturnMw, async (ctx) => {
    await ctx.answerCbQuery();
    const requestId = Number(ctx.match[1]);

    try {
      await requestService.deleteNotifications(
        ctx.telegram,
        'laptop_request',
        requestId,
        ctx.from.id
      );

      const result = await requestService.acceptAndFulfillRequest(requestId, ctx.from.id);

      const cabinet = result.request.groupName ? `, каб. ${result.request.groupName}` : '';
      let msg = `✅ Выдано ментору ${result.request.mentorName}${cabinet}:\n💻 ${result.request.quantity} шт.`;
      if (result.warehouseQuantity) msg += `\n📦 Со склада: ${result.warehouseQuantity}`;
      if (result.coworkingQuantity) msg += `\n🏢 С коворкинга: ${result.coworkingQuantity}`;

      await ctx.editMessageText(msg);
      notifyMentor(ctx, result);
    } catch (err) {
      await ctx.answerCbQuery({ text: err.message, show_alert: true });
    }
  });

  bot.action(/^rr:accept:(\d+)$/, canIssueReturnMw, async (ctx) => {
    await ctx.answerCbQuery();
    try {
      const result = await returnRequestService.respondReturnRequest(
        Number(ctx.match[1]),
        ctx.from.id,
        true
      );
      await ctx.editMessageText(`✅ Возврат от ${result.request.mentorName} принят.`);
      ctx.telegram
        .sendMessage(result.request.mentorTelegramId, '✅ Супорт принял ваш возврат ноутбуков.')
        .catch(() => {});
    } catch (err) {
      await ctx.answerCbQuery({ text: err.message, show_alert: true });
    }
  });

  bot.action(/^rr:reject:(\d+)$/, canIssueReturnMw, async (ctx) => {
    await ctx.answerCbQuery();
    try {
      const result = await returnRequestService.respondReturnRequest(
        Number(ctx.match[1]),
        ctx.from.id,
        false
      );
      await ctx.editMessageText(`❌ Возврат от ${result.request.mentorName} отклонён.`);
      ctx.telegram
        .sendMessage(result.request.mentorTelegramId, '❌ Супорт отклонил возврат. Свяжитесь с супортом.')
        .catch(() => {});
    } catch (err) {
      await ctx.answerCbQuery({ text: err.message, show_alert: true });
    }
  });
}

module.exports = { registerRequestHandlers };
