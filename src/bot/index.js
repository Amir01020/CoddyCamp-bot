require('dotenv').config();

const { Telegraf, session } = require('telegraf');
const { sequelize } = require('../models');
const { adminOnly, getAdminIds } = require('./middlewares/isAdmin');
const { mainMenu } = require('./keyboards');
const { registerAdminHandlers } = require('./handlers/admin');
const { registerReportHandlers } = require('./handlers/reports');

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('❌ BOT_TOKEN не задан в .env');
  process.exit(1);
}

const bot = new Telegraf(token);
bot.use(session());

bot.start(async (ctx) => {
  const admins = getAdminIds();
  const adminHint = admins.length
    ? ''
    : '\n\n⚠️ ADMIN_IDS не задан — сейчас все пользователи считаются админами.\nДобавьте свой ID в .env после команды /myid';

  await ctx.reply(
    '👋 Бот учёта ноутбуков\n\n' +
      'Используйте кнопки меню:\n' +
      '• Выдать / вернуть ноутбук (админ)\n' +
      '• Сегодня — кто брал и кто вернул\n' +
      '• По номеру — кто брал конкретный ноут\n' +
      '• Не возвращены — кто ещё не сдал' +
      adminHint,
    mainMenu()
  );
});

bot.command('myid', async (ctx) => {
  await ctx.reply(`Ваш Telegram ID: ${ctx.from.id}\n\nДобавьте его в ADMIN_IDS в файле .env`);
});

bot.help(async (ctx) => {
  await ctx.reply(
    'Команды:\n' +
      '/start — меню\n' +
      '/myid — узнать свой Telegram ID\n' +
      '/today — кто брал сегодня\n' +
      '/laptop 15 — кто брал ноут №15 сегодня'
  );
});

registerReportHandlers(bot);
registerAdminHandlers(bot, adminOnly);

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
    console.error('❌ Не удалось запустить бота:', err.message);
    console.error('');
    console.error('Проверьте:');
    console.error('  1. MySQL запущен');
    console.error('  2. База laptop_tracker создана');
    console.error('  3. Выполнена миграция: npm run db:migrate');
    console.error('  4. Данные в .env (DB_USER, DB_PASSWORD)');
    process.exit(1);
  }
}

start();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
