const { SupportUser } = require('../../models');

function getAdminIds() {
  const raw = process.env.ADMIN_IDS || '';
  return raw
    .split(',')
    .map((id) => Number(id.trim()))
    .filter((id) => Number.isFinite(id) && id > 0);
}

function isAdmin(userId) {
  const admins = getAdminIds();
  if (!admins.length) return true;
  return admins.includes(userId);
}

async function isSupport(userId) {
  if (isAdmin(userId)) return false;

  const support = await SupportUser.findOne({
    where: { telegramId: userId, isActive: true },
  });
  return !!support;
}

async function getUserRole(userId) {
  if (isAdmin(userId)) return 'admin';
  if (await isSupport(userId)) return 'support';
  return null;
}

async function isAuthorized(userId) {
  if (isAdmin(userId)) return true;
  return isSupport(userId);
}

function isMyIdCommand(ctx) {
  const text = ctx.message?.text?.trim();
  return text === '/myid' || text?.startsWith('/myid@');
}

async function authorizedOnly(ctx, next) {
  const userId = ctx.from?.id;
  if (!userId) return;

  if (isMyIdCommand(ctx)) return next();
  if (await isAuthorized(userId)) return next();

  return ctx.reply('⛔ У вас нет доступа к боту.\nОбратитесь к администратору для получения доступа.');
}

function adminOnly(ctx, next) {
  if (!isAdmin(ctx.from?.id)) {
    return ctx.reply('⛔ Нет доступа. Обратитесь к администратору.');
  }
  return next();
}

async function canIssueReturn(ctx, next) {
  const userId = ctx.from?.id;
  if (isAdmin(userId)) return next();
  if (await isSupport(userId)) return next();
  return ctx.reply('⛔ Нет доступа. Обратитесь к администратору.');
}

module.exports = {
  getAdminIds,
  isAdmin,
  isSupport,
  isAuthorized,
  getUserRole,
  authorizedOnly,
  adminOnly,
  canIssueReturn,
};
