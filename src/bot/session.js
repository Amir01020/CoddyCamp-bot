function clearState(ctx) {
  ctx.session = ctx.session || {};
  ctx.session.step = null;
  ctx.session.data = {};
  ctx.session.menu = null;
}

module.exports = { clearState };
