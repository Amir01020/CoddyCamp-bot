require('dotenv').config();

const { Telegraf, session } = require('telegraf');
const { createProxyAgent, maskProxyUrl } = require('./proxy');
const { sequelize } = require('../models');
const {
  adminOnly,
  canIssueReturn,
  mentorOnly,
  authorizedOnly,
  getAdminIds,
  getUserRole,
} = require('./middlewares/isAdmin');
const { safeReply, formatUserError } = require('./utils/telegram');
const { menuForRole } = require('./keyboards');
const { registerMenuHandlers } = require('./handlers/menu');
const { registerMentorHandlers } = require('./handlers/mentor');
const { registerRequestHandlers } = require('./handlers/requests');

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('❌ BOT_TOKEN не задан в .env');
  process.exit(1);
}

const proxyUrl = process.env.TELEGRAM_PROXY || process.env.HTTPS_PROXY;
const botOptions = {};

if (proxyUrl) {
  botOptions.telegram = {
    agent: createProxyAgent(proxyUrl),
  };
  console.log('🌐 Используется прокси для Telegram:', maskProxyUrl(proxyUrl));
} else {
  console.log('⚠️ TELEGRAM_PROXY не задан — при ECONNRESET добавьте прокси в .env');
}

const bot = new Telegraf(token, botOptions);
bot.use(session());
bot.use(authorizedOnly);

bot.command('myid', async (ctx) => {
  const role = await getUserRole(ctx.from.id);
  if (role) {
    await ctx.reply(`Ваш Telegram ID: ${ctx.from.id}`);
    return;
  }
  await ctx.reply(
    `Ваш Telegram ID: ${ctx.from.id}\n\nПередайте администратору для получения доступа.`
  );
});

bot.start(async (ctx) => {
  const admins = getAdminIds();
  const role = await getUserRole(ctx.from.id);
  const adminHint = admins.length
    ? ''
    : '\n\n⚠️ ADMIN_IDS не задан — все пользователи считаются админами.';

  const roleHints = {
    admin:
      'Меню:\n' +
      '📦 Склад — взять ноуты, размер склада\n' +
      'ℹ️ Информация — склад, коворкинг, менторы\n' +
      '👥 Супорты / 👨‍🏫 Менторы — управление',
    support:
      'Меню:\n' +
      '📦 Склад — взять со склада, забрать с коворкинга или у ментора\n' +
      'ℹ️ Информация — текущие остатки',
    mentor:
      'Меню:\n' +
      '📦 Запросить ноутбуки — запрос супортам\n' +
      '📥 Вернуть ноутбуки — возврат после урока',
  };

  await ctx.reply(
    '👋 Бот учёта ноутбуков\n\n' + (roleHints[role] || 'Нет доступа.') + adminHint,
    menuForRole(role)
  );
});

bot.help(async (ctx) => {
  await ctx.reply('Команды: /start — меню, /myid — ваш Telegram ID');
});

registerMenuHandlers(bot, adminOnly, canIssueReturn);
registerMentorHandlers(bot, mentorOnly);
registerRequestHandlers(bot, canIssueReturn);

bot.catch(async (err, ctx) => {
  console.error('Bot error:', err);
  try {
    await safeReply(ctx, `❌ ${formatUserError(err)}`);
  } catch {
    // ignore secondary network failure
  }
});

async function start() {
  try {
    await sequelize.authenticate();
    console.log('✅ Подключение к MySQL установлено');
    await bot.launch();
    console.log('✅ Telegram-бот запущен');
  } catch (err) {
    console.error('❌ Не удалось запустить бота:', err.message);
    process.exit(1);
  }
}

start();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
