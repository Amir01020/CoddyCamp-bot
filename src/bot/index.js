require('dotenv').config();

const { Telegraf, session } = require('telegraf');
const { createProxyAgent, maskProxyUrl } = require('./proxy');
const { sequelize } = require('../models');
const { adminOnly, canIssueReturn, authorizedOnly, getAdminIds, getUserRole } = require('./middlewares/isAdmin');
const { menuForRole } = require('./keyboards');
const { registerMenuHandlers } = require('./handlers/menu');

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('❌ BOT_TOKEN не задан в .env');
  process.exit(1);
}

const proxyUrl = process.env.TELEGRAM_PROXY || process.env.HTTPS_PROXY;
const botOptions = {};

if (proxyUrl) {
  botOptions.telegram = { agent: createProxyAgent(proxyUrl) };
  console.log('🌐 Используется прокси для Telegram:', maskProxyUrl(proxyUrl));
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

  await ctx.reply(
    '👋 Бот учёта ноутбуков\n\n' +
      'Меню:\n' +
      '💻 Ноутбуки — добавить, выдать, вернуть\n' +
      '👨‍🏫 Учителя — выдать/вернуть несколько ноутов\n' +
      '👨‍🎓 Ученики — список, статус, подписка\n' +
      '⏳ Занятые — кто какой ноут держит\n' +
      '👥 Супорты — управление (админ)' +
      adminHint,
    menuForRole(role)
  );
});

bot.help(async (ctx) => {
  await ctx.reply('Команды: /start — меню, /myid — ваш Telegram ID');
});

registerMenuHandlers(bot, adminOnly, canIssueReturn);

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
