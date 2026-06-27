const { MENU, STEPS } = require('../constants');
const { clearState } = require('../session');
const {
  mentorReturnMenu,
  cancelMenu,
  supportSelectInline,
  qtyInline,
} = require('../keyboards');
const { getUserRole } = require('../middlewares/isAdmin');
const mentorService = require('../../services/mentorService');
const supportService = require('../../services/supportService');
const requestService = require('../../services/requestService');
const returnRequestService = require('../../services/returnRequestService');
const { replyMain, ensureSession } = require('./menu');

async function showMentorReturnSupportList(ctx) {
  const supports = await supportService.listSupports();
  if (!supports.length) {
    await ctx.reply('❌ Нет доступных супортов.');
    return;
  }
  await ctx.reply('Кому возвращаете?', supportSelectInline(supports, 'mr:support'));
}

async function submitReturnRequest(ctx) {
  const data = ctx.session.data;
  const mentor = await mentorService.getMentorByTelegramId(ctx.from.id);
  if (!mentor) throw new Error('Ментор не найден');

  const request = await returnRequestService.createReturnRequest({
    mentorTelegramId: ctx.from.id,
    mentorName: mentor.name,
    supportTelegramId: data.supportTelegramId,
    warehouseQuantity: data.warehouseReturnQty || 0,
    coworkingQuantity: data.coworkingReturnQty || 0,
  });

  await returnRequestService.broadcastReturnRequest(ctx.telegram, request);
  clearState(ctx);
  await replyMain(ctx, '✅ Запрос на возврат отправлен супорту.');
}

function registerMentorHandlers(bot, mentorOnlyMw) {
  bot.hears(MENU.MENTOR_REQUEST, mentorOnlyMw, async (ctx) => {
    const mentor = await mentorService.getMentorByTelegramId(ctx.from.id);
    if (!mentor) {
      await ctx.reply('❌ Вы не зарегистрированы как ментор.');
      return;
    }
    ensureSession(ctx).step = STEPS.MENTOR_REQUEST_QTY;
    ensureSession(ctx).data = { mentorName: mentor.name };
    await ctx.reply('Сколько ноутбуков нужно?', cancelMenu());
  });

  bot.hears(MENU.MENTOR_RETURN, mentorOnlyMw, async (ctx) => {
    const holdings = await mentorService.getMentorHoldings(ctx.from.id);
    if (!holdings.total) {
      await ctx.reply('📋 У вас нет ноутбуков для возврата.');
      return;
    }
    ensureSession(ctx).menu = 'mentor_return';
    ensureSession(ctx).data = { holdings };
    await ctx.reply(
      mentorService.formatMentorHoldings(holdings) + '\n\nВыберите:',
      mentorReturnMenu()
    );
  });

  bot.hears(MENU.RETURN_ALL, mentorOnlyMw, async (ctx) => {
    if (ctx.session?.menu !== 'mentor_return') return;
    const holdings = ctx.session.data.holdings || (await mentorService.getMentorHoldings(ctx.from.id));
    ctx.session.data.warehouseReturnQty = holdings.warehouse;
    ctx.session.data.coworkingReturnQty = holdings.coworking;
    ctx.session.step = STEPS.MENTOR_RETURN_SUPPORT;
    await showMentorReturnSupportList(ctx);
  });

  bot.hears(MENU.RETURN_PICK, mentorOnlyMw, async (ctx) => {
    if (ctx.session?.menu !== 'mentor_return') return;
    const holdings = ctx.session.data.holdings || (await mentorService.getMentorHoldings(ctx.from.id));
    ensureSession(ctx).step = STEPS.MENTOR_RETURN_QTY;
    await ctx.reply(
      `У вас ${holdings.total} шт.\nСколько вернуть?`,
      qtyInline(holdings.total, 'mr:qty')
    );
  });

  bot.action(/^mr:qty:(\d+|cancel)$/, mentorOnlyMw, async (ctx) => {
    await ctx.answerCbQuery();
    const value = ctx.match[1];
    if (value === 'cancel') {
      clearState(ctx);
      await replyMain(ctx, 'Отменено.');
      return;
    }

    const qty = Number(value);
    const holdings = ctx.session.data.holdings;
    const split = mentorService.splitReturnQty(holdings, qty);
    ctx.session.data.warehouseReturnQty = split.warehouseQuantity;
    ctx.session.data.coworkingReturnQty = split.coworkingQuantity;
    ctx.session.step = STEPS.MENTOR_RETURN_SUPPORT;
    await showMentorReturnSupportList(ctx);
  });

  bot.action(/^mr:support:(\d+|cancel)$/, mentorOnlyMw, async (ctx) => {
    await ctx.answerCbQuery();
    const value = ctx.match[1];
    if (value === 'cancel') {
      clearState(ctx);
      await replyMain(ctx, 'Отменено.');
      return;
    }

    ctx.session.data.supportTelegramId = Number(value);
    try {
      await submitReturnRequest(ctx);
    } catch (err) {
      await ctx.reply(`❌ ${err.message}`);
    }
  });

  bot.on('text', async (ctx, next) => {
    const step = ctx.session?.step;
    if (!step) return next();

    const role = await getUserRole(ctx.from.id);
    if (role !== 'mentor' && role !== 'admin') return next();

    const text = ctx.message.text?.trim();
    if (!text || text === MENU.CANCEL) return next();

    try {
      if (step === STEPS.MENTOR_REQUEST_QTY) {
        const qty = Number(text);
        if (!Number.isFinite(qty) || qty <= 0) {
          throw new Error('Введите число больше 0');
        }
        ctx.session.data.quantity = qty;
        ctx.session.step = STEPS.MENTOR_REQUEST_CABINET;
        await ctx.reply('В какой кабинет?', cancelMenu());
        return;
      }

      if (step === STEPS.MENTOR_REQUEST_CABINET) {
        const request = await requestService.createLaptopRequest({
          mentorTelegramId: ctx.from.id,
          mentorName: ctx.session.data.mentorName,
          groupName: text,
          quantity: ctx.session.data.quantity,
        });
        await requestService.broadcastLaptopRequest(ctx.telegram, request);
        clearState(ctx);
        await replyMain(
          ctx,
          `✅ Запрос на ${ctx.session.data.quantity} ноутов (кабинет ${text}) отправлен супортам.`
        );
      }
    } catch (err) {
      await ctx.reply(`❌ ${err.message}`);
    }
  });
}

module.exports = { registerMentorHandlers };
