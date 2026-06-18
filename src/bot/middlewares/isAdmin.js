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

function adminOnly(ctx, next) {
  if (!isAdmin(ctx.from?.id)) {
    return ctx.reply('⛔ Нет доступа. Обратитесь к администратору.');
  }
  return next();
}

module.exports = {
  getAdminIds,
  isAdmin,
  adminOnly,
};
