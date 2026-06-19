require('dotenv').config();

const { Telegraf, session } = require('telegraf');
const { createProxyAgent, maskProxyUrl } = require('./proxy');
const { sequelize } = require('../models');
const { adminOnly, canIssueReturn, authorizedOnly, getAdminIds, getUserRole } = require('./middlewares/isAdmin');
const { menuForRole } = require('./keyboards');
const { registerAdminHandlers } = require('./handlers/admin');
const { registerReportHandlers } = require('./handlers/reports');

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
    `Ваш Telegram ID: ${ctx.from.id}\n\n` +
      'Передайте этот ID администратору, чтобы получить доступ к боту.'
  );
});

bot.start(async (ctx) => {
  const admins = getAdminIds();
  const role = await getUserRole(ctx.from.id);
  const adminHint = admins.length
    ? ''
    : '\n\n⚠️ ADMIN_IDS не задан — сейчас все пользователи считаются админами.\nДобавьте свой ID в .env после команды /myid';

  let roleHint = '';
  if (role === 'support') {
    roleHint = '\n\nВы — супорт. Доступны только выдача и возврат ноутбуков ученикам.';
  }

  await ctx.reply(
    '👋 Бот учёта ноутбуков\n\n' +
      'Используйте кнопки меню:\n' +
      '• Выдать / вернуть ноутбук\n' +
      '• Выдать учителю — несколько ноутов на урок (админ)\n' +
      '• Вернуть от учителя — все ноуты учителя сразу (админ)\n' +
      '• Сегодня — кто брал и кто вернул (админ)\n' +
      '• По номеру — кто брал конкретный ноут (админ)\n' +
      '• Не возвращены — кто ещё не сдал (админ)\n' +
      '• Супорты — назначение супортов (админ)' +
      adminHint +
      roleHint,
    menuForRole(role)
  );
});

bot.help(async (ctx) => {
  const role = await getUserRole(ctx.from.id);
  let text =
    'Команды:\n' +
    '/start — меню\n' +
    '/myid — узнать свой Telegram ID\n';

  if (role === 'admin') {
    text += '/today — кто брал сегодня\n' + '/laptop 15 — кто брал ноут №15 сегодня';
  }

  await ctx.reply(text);
});

registerAdminHandlers(bot, adminOnly, canIssueReturn);
registerReportHandlers(bot, adminOnly);

async function start() {
  try {
    await sequelize.authenticate();
    console.log('✅ Подключение к MySQL установлено');

    await bot.launch();
    console.log('✅ Telegram-бот запущен');

    const admins = getAdminIds();
    if (!admins.length) {
      console.log('⚠️  ADMIN_IDS пуст — все пользователи имеют права админа');
      console.log('   Отправьте боту /myid и добавьте ID в .env');
    }
  } catch (err) {
    const reason = err.cause?.message || err.cause?.code || '';
    console.error('❌ Не удалось запустить бота:', err.message);
    if (reason) console.error('Причина:', reason);
    if (err.code) console.error('Код ошибки:', err.code);

    if (String(err.message).includes('api.telegram.org')) {
      console.error('');
      console.error('Сервер не может подключиться к Telegram API.');
      console.error('На сервере выполните:');
      console.error('  curl -I https://api.telegram.org');
      console.error('  docker compose exec bot wget -qO- https://api.telegram.org || echo FAIL');
      console.error('');
      console.error('Если не открывается — добавьте в .env прокси:');
      console.error('  TELEGRAM_PROXY=http://user:pass@host:port');
      console.error('');
      console.error('Также остановите локальный npm start на ПК — один токен нельзя использовать в двух местах.');
    } else {
      console.error('');
      console.error('Проверьте:');
      console.error('  1. MySQL запущен');
      console.error('  2. База laptop_tracker создана');
      console.error('  3. Выполнена миграция: npm run db:migrate');
      console.error('  4. Данные в .env (DB_USER, DB_PASSWORD)');
    }
    process.exit(1);
  }
}

start();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
