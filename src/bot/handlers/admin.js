const { issueLaptop, returnLaptop } = require('../../services/issueService');

const STEPS = {
  ISSUE_NAME: 'issue_name',
  ISSUE_LAPTOP: 'issue_laptop',
  RETURN_LAPTOP: 'return_laptop',
  LAPTOP_QUERY: 'laptop_query',
};

function clearState(ctx) {
  ctx.session = ctx.session || {};
  ctx.session.step = null;
  ctx.session.data = {};
}

function registerAdminHandlers(bot, adminOnly) {
  bot.hears('📤 Выдать ноутбук', adminOnly, async (ctx) => {
    ctx.session = ctx.session || {};
    ctx.session.step = STEPS.ISSUE_NAME;
    ctx.session.data = {};
    await ctx.reply('Введите имя ученика:', require('../keyboards').cancelMenu());
  });

  bot.hears('📥 Вернуть ноутбук', adminOnly, async (ctx) => {
    ctx.session = ctx.session || {};
    ctx.session.step = STEPS.RETURN_LAPTOP;
    ctx.session.data = {};
    await ctx.reply('Введите номер ноутбука для возврата:', require('../keyboards').cancelMenu());
  });

  bot.hears('❌ Отмена', async (ctx) => {
    clearState(ctx);
    await ctx.reply('Действие отменено.', require('../keyboards').mainMenu());
  });

  bot.on('text', adminOnly, async (ctx, next) => {
    const text = ctx.message.text?.trim();
    if (!text || text.startsWith('/')) return next();

    const step = ctx.session?.step;
    if (!step) return next();

    if (text === '❌ Отмена') return next();

    try {
      if (step === STEPS.ISSUE_NAME) {
        ctx.session.data.studentName = text;
        ctx.session.step = STEPS.ISSUE_LAPTOP;
        await ctx.reply(`Ученик: ${text}\nТеперь введите номер ноутбука:`);
        return;
      }

      if (step === STEPS.ISSUE_LAPTOP) {
        const result = await issueLaptop({
          studentName: ctx.session.data.studentName,
          laptopNumber: text,
          adminId: ctx.from.id,
        });

        clearState(ctx);
        await ctx.reply(
          `✅ Выдано!\n\n` +
            `Ученик: ${result.student.name}\n` +
            `Ноутбук: №${result.laptop.number}\n` +
            `Время: ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`,
          require('../keyboards').mainMenu()
        );
        return;
      }

      if (step === STEPS.RETURN_LAPTOP) {
        const result = await returnLaptop({
          laptopNumber: text,
          adminId: ctx.from.id,
        });

        clearState(ctx);
        await ctx.reply(
          `✅ Возврат принят!\n\n` +
            `Ученик: ${result.student.name}\n` +
            `Ноутбук: №${result.laptop.number}\n` +
            `Время: ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`,
          require('../keyboards').mainMenu()
        );
        return;
      }
    } catch (err) {
      await ctx.reply(`❌ ${err.message}`);
    }
  });
}

module.exports = {
  STEPS,
  clearState,
  registerAdminHandlers,
};
