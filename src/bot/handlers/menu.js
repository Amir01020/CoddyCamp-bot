const { MENU, STEPS } = require('../constants');
const { clearState } = require('../session');
const {
  menuForRole,
  warehouseAdminMenu,
  warehouseSupportMenu,
  supportsMenu,
  mentorsMenu,
  cancelMenu,
  destMenu,
  returnDestMenu,
  takeQtyMenu,
  mentorSelectInline,
} = require('../keyboards');
const { getUserRole, isAdmin } = require('../middlewares/isAdmin');
const supportService = require('../../services/supportService');
const mentorService = require('../../services/mentorService');
const warehouseService = require('../../services/warehouseService');
const { safeReply, formatUserError } = require('../utils/telegram');

async function replyMain(ctx, text) {
  const role = await getUserRole(ctx.from.id);
  await safeReply(ctx, text, menuForRole(role));
}

function ensureSession(ctx) {
  ctx.session = ctx.session || {};
  return ctx.session;
}

async function notifyMentorTaken(ctx, result) {
  const dest = result.destination === 'warehouse' ? 'на склад' : 'на коворкинг';
  try {
    await ctx.telegram.sendMessage(
      result.mentor.telegramId,
      `📥 Супорт забрал ${result.count} ноутов (${dest})`
    );
  } catch {
    // mentor may have blocked bot
  }
}

function startTakeFromWarehouse(ctx) {
  ensureSession(ctx).step = STEPS.TAKE_WAREHOUSE_QTY;
  ensureSession(ctx).data = {};
}

async function promptTakeQuantity(ctx) {
  const stats = await warehouseService.getWarehouseStats();
  if (!stats.available) {
    await ctx.reply('❌ На складе нет ноутбуков.');
    return;
  }
  startTakeFromWarehouse(ctx);
  await ctx.reply(
    `На складе: ${stats.available} шт.\n\nСколько взять со склада?`,
    cancelMenu()
  );
}

function registerMenuHandlers(bot, adminOnly, canIssueReturn) {
  bot.hears(MENU.BACK, async (ctx) => {
    clearState(ctx);
    await replyMain(ctx, 'Главное меню.');
  });

  bot.hears(MENU.CANCEL, async (ctx) => {
    clearState(ctx);
    await replyMain(ctx, 'Действие отменено.');
  });

  bot.hears(MENU.INFO, canIssueReturn, async (ctx) => {
    await ctx.reply(await warehouseService.formatFullInfo());
  });

  bot.hears(MENU.WAREHOUSE, canIssueReturn, async (ctx) => {
    const role = await getUserRole(ctx.from.id);
    ensureSession(ctx).menu = 'warehouse';
    if (role === 'admin') {
      await ctx.reply('📦 Склад:', warehouseAdminMenu());
      return;
    }
    await ctx.reply('📦 Склад:', warehouseSupportMenu());
  });

  bot.hears(MENU.TAKE_FROM_WAREHOUSE, canIssueReturn, async (ctx) => {
    await promptTakeQuantity(ctx);
  });

  bot.hears(MENU.TAKE_FROM_COWORKING, canIssueReturn, async (ctx) => {
    const stats = await warehouseService.getWarehouseStats();
    if (!stats.coworking) {
      await ctx.reply('❌ На коворкинге нет ноутбуков.');
      return;
    }
    ensureSession(ctx).step = STEPS.TAKE_FROM_COWORKING_QTY;
    ensureSession(ctx).data = {};
    await ctx.reply(
      `На коворкинге: ${stats.coworking} шт.\n\nСколько забрать на склад?`,
      cancelMenu()
    );
  });

  bot.hears(MENU.TAKE_FROM_MENTOR, canIssueReturn, async (ctx) => {
    const mentors = await mentorService.listMentors();
    const withHoldings = mentors.filter(
      (m) => (m.warehouseHoldings || 0) + (m.coworkingHoldings || 0) > 0
    );
    if (!withHoldings.length) {
      await ctx.reply('❌ Ни у одного ментора нет ноутбуков.');
      return;
    }
    ensureSession(ctx).step = STEPS.TAKE_FROM_MENTOR_PICK;
    ensureSession(ctx).data = {};
    await ctx.reply('У кого забрать ноутбуки?', mentorSelectInline(withHoldings, 'fm:mentor'));
  });

  bot.hears(MENU.TAKE_ALL, canIssueReturn, async (ctx) => {
    if (ctx.session?.step !== STEPS.TAKE_FROM_MENTOR_PICK) return;
    const maxQty = ctx.session.data.maxQty;
    if (!maxQty) return;

    ctx.session.data.count = maxQty;
    ctx.session.step = STEPS.TAKE_FROM_MENTOR_DEST;
    await ctx.reply(`Куда положить ${maxQty} ноутов?`, returnDestMenu());
  });

  bot.hears(MENU.TAKE_CUSTOM, canIssueReturn, async (ctx) => {
    if (ctx.session?.step !== STEPS.TAKE_FROM_MENTOR_PICK) return;
    const maxQty = ctx.session.data.maxQty;
    if (!maxQty) return;

    ctx.session.step = STEPS.TAKE_FROM_MENTOR_QTY_INPUT;
    await ctx.reply(`Введите количество (макс. ${maxQty}):`, cancelMenu());
  });

  bot.hears(MENU.TO_WAREHOUSE, canIssueReturn, async (ctx) => {
    if (ctx.session?.step !== STEPS.TAKE_FROM_MENTOR_DEST || !ctx.session.data?.count) return;

    const { mentorTelegramId, count } = ctx.session.data;
    let result;
    try {
      result = await warehouseService.takeFromMentor({
        mentorTelegramId,
        count,
        destination: 'warehouse',
      });
    } catch (err) {
      await safeReply(ctx, `❌ ${err.message}`);
      return;
    }

    clearState(ctx);
    const text = `✅ Забрано у ${result.mentor.name}: ${result.count} шт. → на склад`;
    try {
      await replyMain(ctx, text);
    } catch (err) {
      await safeReply(ctx, `${text}\n\n(нажмите /start для обновления меню)`);
    }
    notifyMentorTaken(ctx, result);
  });

  bot.hears(MENU.TO_COWORKING, canIssueReturn, async (ctx) => {
    if (ctx.session?.step !== STEPS.TAKE_FROM_MENTOR_DEST || !ctx.session.data?.count) return;

    const { mentorTelegramId, count } = ctx.session.data;
    let result;
    try {
      result = await warehouseService.takeFromMentor({
        mentorTelegramId,
        count,
        destination: 'coworking',
      });
    } catch (err) {
      await safeReply(ctx, `❌ ${err.message}`);
      return;
    }

    clearState(ctx);
    const text = `✅ Забрано у ${result.mentor.name}: ${result.count} шт. → на коворкинг`;
    try {
      await replyMain(ctx, text);
    } catch (err) {
      await safeReply(ctx, `${text}\n\n(нажмите /start для обновления меню)`);
    }
    notifyMentorTaken(ctx, result);
  });

  bot.hears(MENU.WAREHOUSE_SET, adminOnly, async (ctx) => {
    const stats = await warehouseService.getWarehouseStats();
    ensureSession(ctx).step = STEPS.WAREHOUSE_SET_TOTAL;
    await ctx.reply(
      `Всего ноутов: ${stats.total}\nНа складе: ${stats.available}\n\nВведите новый общий размер склада:`,
      cancelMenu()
    );
  });

  bot.hears(MENU.DEST_COWORKING, canIssueReturn, async (ctx) => {
    if (ctx.session?.step !== STEPS.TAKE_WAREHOUSE_DEST || !ctx.session.data?.count) return;
    try {
      const result = await warehouseService.moveToCoworking({ count: ctx.session.data.count });
      clearState(ctx);
      await replyMain(ctx, `✅ На коворкинг: ${result.moved} шт.`);
    } catch (err) {
      await ctx.reply(`❌ ${err.message}`);
    }
  });

  bot.hears(MENU.DEST_MENTOR, canIssueReturn, async (ctx) => {
    if (ctx.session?.step !== STEPS.TAKE_WAREHOUSE_DEST || !ctx.session.data?.count) return;
    const mentors = await mentorService.listMentors();
    if (!mentors.length) {
      await ctx.reply('❌ Нет менторов. Добавьте через меню «👨‍🏫 Менторы».');
      return;
    }
    ctx.session.step = STEPS.TAKE_MENTOR_CLASS;
    await ctx.reply('Выберите ментора:', mentorSelectInline(mentors, 'tw:mentor'));
  });

  bot.hears(MENU.SUPPORTS, adminOnly, async (ctx) => {
    ensureSession(ctx).menu = 'supports';
    const supports = await supportService.listSupports();
    await ctx.reply(
      supportService.formatSupportList(supports) + '\n\nУправление супортами:',
      supportsMenu()
    );
  });

  bot.hears(MENU.MENTORS, adminOnly, async (ctx) => {
    ensureSession(ctx).menu = 'mentors';
    const mentors = await mentorService.listMentors();
    await ctx.reply(
      mentorService.formatMentorList(mentors) + '\n\nУправление менторами:',
      mentorsMenu()
    );
  });

  bot.hears(MENU.ADD_SUPPORT, adminOnly, async (ctx) => {
    ensureSession(ctx).step = STEPS.SUPPORT_ADD;
    await ctx.reply('Telegram ID супорта (можно с именем): 123456789 Иван', cancelMenu());
  });

  bot.hears(MENU.REMOVE_SUPPORT, adminOnly, async (ctx) => {
    ensureSession(ctx).step = STEPS.SUPPORT_REMOVE;
    await ctx.reply('Telegram ID супорта для удаления:', cancelMenu());
  });

  bot.hears(MENU.ADD_MENTOR, adminOnly, async (ctx) => {
    ensureSession(ctx).step = STEPS.MENTOR_ADD;
    await ctx.reply('Telegram ID и имя ментора: 123456789 Иван', cancelMenu());
  });

  bot.hears(MENU.REMOVE_MENTOR, adminOnly, async (ctx) => {
    ensureSession(ctx).step = STEPS.MENTOR_REMOVE;
    await ctx.reply('Telegram ID ментора для удаления:', cancelMenu());
  });

  bot.action(/^fm:mentor:(\d+|cancel)$/, canIssueReturn, async (ctx) => {
    await ctx.answerCbQuery();
    const value = ctx.match[1];
    if (value === 'cancel') {
      clearState(ctx);
      await replyMain(ctx, 'Отменено.');
      return;
    }

    const mentor = await mentorService.getMentorByTelegramId(Number(value));
    if (!mentor) {
      await ctx.reply('❌ Ментор не найден.');
      return;
    }

    const holdings = await mentorService.getMentorHoldings(Number(value));
    if (!holdings.total) {
      await ctx.reply('❌ У ментора нет ноутбуков.');
      return;
    }

    ctx.session.data.mentorTelegramId = Number(value);
    ctx.session.data.mentorName = mentor.name;
    ctx.session.data.maxQty = holdings.total;
    ctx.session.step = STEPS.TAKE_FROM_MENTOR_PICK;

    await ctx.reply(
      `${mentor.name}: ${holdings.total} шт.\n\nСколько забрать?`,
      takeQtyMenu()
    );
  });

  bot.action(/^tw:mentor:(\d+|cancel)$/, canIssueReturn, async (ctx) => {
    await ctx.answerCbQuery();
    const value = ctx.match[1];
    if (value === 'cancel') {
      clearState(ctx);
      await replyMain(ctx, 'Отменено.');
      return;
    }

    ctx.session.data.mentorTelegramId = Number(value);
    ctx.session.step = STEPS.TAKE_MENTOR_CLASS;
    await ctx.reply('В какой кабинет/класс?', cancelMenu());
  });

  bot.on('text', async (ctx, next) => {
    const text = ctx.message.text?.trim();
    if (!text || text.startsWith('/') || text === MENU.CANCEL) return next();

    const menuTexts = Object.values(MENU);
    if (menuTexts.includes(text)) return next();

    const step = ctx.session?.step;
    if (!step) return next();

    const userId = ctx.from.id;
    const adminSteps = [
      STEPS.SUPPORT_ADD,
      STEPS.SUPPORT_REMOVE,
      STEPS.MENTOR_ADD,
      STEPS.MENTOR_REMOVE,
      STEPS.WAREHOUSE_SET_TOTAL,
    ];

    if (adminSteps.includes(step) && !isAdmin(userId)) {
      return ctx.reply('⛔ Нет доступа.');
    }

    try {
      if (step === STEPS.WAREHOUSE_SET_TOTAL) {
        const result = await warehouseService.setWarehouseTotal(text);
        clearState(ctx);
        await replyMain(ctx, `✅ Всего ноутов: ${result.total} (${result.available} на складе)`);
        return;
      }

      if (step === STEPS.TAKE_WAREHOUSE_QTY) {
        const qty = Number(text);
        if (!Number.isFinite(qty) || qty <= 0) {
          throw new Error('Введите число больше 0');
        }
        const stats = await warehouseService.getWarehouseStats();
        if (qty > stats.available) {
          throw new Error(`На складе только ${stats.available} ноутов`);
        }
        ctx.session.data.count = qty;
        ctx.session.step = STEPS.TAKE_WAREHOUSE_DEST;
        await ctx.reply(`Куда направить ${qty} ноутов?`, destMenu());
        return;
      }

      if (step === STEPS.TAKE_FROM_COWORKING_QTY) {
        const qty = Number(text);
        if (!Number.isFinite(qty) || qty <= 0) {
          throw new Error('Введите число больше 0');
        }
        const result = await warehouseService.moveToWarehouse({ count: qty });
        clearState(ctx);
        await replyMain(ctx, `✅ С коворкинга на склад: ${result.moved} шт.`);
        return;
      }

      if (step === STEPS.TAKE_FROM_MENTOR_QTY_INPUT) {
        const qty = Number(text);
        if (!Number.isFinite(qty) || qty <= 0) {
          throw new Error('Введите число больше 0');
        }
        const maxQty = ctx.session.data.maxQty;
        if (!maxQty) {
          throw new Error('Сначала выберите ментора');
        }
        if (qty > maxQty) {
          throw new Error(`У ментора только ${maxQty} ноутов`);
        }
        ctx.session.data.count = qty;
        ctx.session.step = STEPS.TAKE_FROM_MENTOR_DEST;
        await ctx.reply(`Куда положить ${qty} ноутов?`, returnDestMenu());
        return;
      }

      if (step === STEPS.TAKE_MENTOR_CLASS) {
        const { count, mentorTelegramId } = ctx.session.data;
        const result = await warehouseService.giveToMentor({
          count,
          mentorTelegramId,
          className: text,
        });
        clearState(ctx);
        await replyMain(
          ctx,
          `✅ Ментору ${result.mentor.name}: ${result.count} шт.\n🚪 Кабинет: ${text}`
        );

        try {
          await ctx.telegram.sendMessage(
            mentorTelegramId,
            `✅ Вам выдано ${result.count} ноутов\n🚪 Кабинет: ${text}`
          );
        } catch {
          // mentor may have blocked bot
        }
        return;
      }

      if (step === STEPS.SUPPORT_ADD) {
        const parts = text.split(/\s+/);
        await supportService.addSupport({
          telegramId: parts[0],
          name: parts.slice(1).join(' ') || null,
          createdBy: userId,
        });
        clearState(ctx);
        await replyMain(ctx, `✅ Супорт ${parts[0]} добавлен.`);
        return;
      }

      if (step === STEPS.SUPPORT_REMOVE) {
        await supportService.removeSupport(text);
        clearState(ctx);
        await replyMain(ctx, '✅ Супорт удалён.');
        return;
      }

      if (step === STEPS.MENTOR_ADD) {
        const parts = text.split(/\s+/);
        const telegramId = parts[0];
        const name = parts[1];
        if (!name) throw new Error('Формат: ID Имя');
        await mentorService.addMentor({
          telegramId,
          name,
          createdBy: userId,
        });
        clearState(ctx);
        await replyMain(ctx, `✅ Ментор «${name}» добавлен.`);
        return;
      }

      if (step === STEPS.MENTOR_REMOVE) {
        await mentorService.removeMentor(text);
        clearState(ctx);
        await replyMain(ctx, '✅ Ментор удалён.');
        return;
      }
    } catch (err) {
      await ctx.reply(`❌ ${err.message}`);
    }

    return next();
  });
}

module.exports = { registerMenuHandlers, replyMain, ensureSession };
