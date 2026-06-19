const reportService = require('../../services/reportService');
const { STEPS, clearState } = require('./admin');
const { menuForRole, cancelMenu } = require('../keyboards');
const { getUserRole } = require('../middlewares/isAdmin');

function registerReportHandlers(bot, adminOnly) {
  bot.hears('📅 Сегодня', adminOnly, async (ctx) => {
    try {
      const transactions = await reportService.getTodayReport();
      await ctx.reply(reportService.formatTodayReport(transactions));
    } catch (err) {
      await ctx.reply(`❌ Ошибка: ${err.message}`);
    }
  });

  bot.hears('⏳ Не возвращены', adminOnly, async (ctx) => {
    try {
      const transactions = await reportService.getActiveIssues();
      await ctx.reply(reportService.formatActiveReport(transactions));
    } catch (err) {
      await ctx.reply(`❌ Ошибка: ${err.message}`);
    }
  });

  bot.hears('💻 По номеру ноутбука', adminOnly, async (ctx) => {
    ctx.session = ctx.session || {};
    ctx.session.step = STEPS.LAPTOP_QUERY;
    ctx.session.data = {};
    await ctx.reply('Введите номер ноутбука:', cancelMenu());
  });

  bot.on('text', async (ctx, next) => {
    const text = ctx.message.text?.trim();
    if (!text || text.startsWith('/') || text === '❌ Отмена') return next();
    if (ctx.session?.step !== STEPS.LAPTOP_QUERY) return next();

    try {
      const transactions = await reportService.getLaptopTodayReport(text);
      clearState(ctx);
      const role = await getUserRole(ctx.from.id);
      await ctx.reply(reportService.formatLaptopReport(text, transactions), menuForRole(role));
    } catch (err) {
      await ctx.reply(`❌ ${err.message}`);
    }
  });

  bot.command('today', adminOnly, async (ctx) => {
    try {
      const transactions = await reportService.getTodayReport();
      await ctx.reply(reportService.formatTodayReport(transactions));
    } catch (err) {
      await ctx.reply(`❌ Ошибка: ${err.message}`);
    }
  });

  bot.command('laptop', adminOnly, async (ctx) => {
    const number = ctx.message.text.split(' ').slice(1).join(' ').trim();
    if (!number) {
      await ctx.reply('Использование: /laptop 15');
      return;
    }

    try {
      const transactions = await reportService.getLaptopTodayReport(number);
      await ctx.reply(reportService.formatLaptopReport(number, transactions));
    } catch (err) {
      await ctx.reply(`❌ Ошибка: ${err.message}`);
    }
  });
}

module.exports = {
  registerReportHandlers,
};
