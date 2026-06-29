const { Markup } = require('telegraf');
const { MENU } = require('./constants');

const adminMainMenu = () =>
  Markup.keyboard([
    [MENU.WAREHOUSE, MENU.INFO],
    [MENU.MENTORS, MENU.SUPPORTS],
  ]).resize();

const supportMainMenu = () =>
  Markup.keyboard([[MENU.WAREHOUSE, MENU.INFO]]).resize();

const mentorMainMenu = () =>
  Markup.keyboard([[MENU.MENTOR_REQUEST, MENU.MENTOR_RETURN]]).resize();

const warehouseAdminMenu = () =>
  Markup.keyboard([
    [MENU.TAKE_FROM_WAREHOUSE],
    [MENU.TAKE_FROM_COWORKING, MENU.TAKE_FROM_MENTOR],
    [MENU.WAREHOUSE_SET],
    [MENU.BACK],
  ]).resize();

const warehouseSupportMenu = () =>
  Markup.keyboard([
    [MENU.TAKE_FROM_WAREHOUSE],
    [MENU.TAKE_FROM_COWORKING, MENU.TAKE_FROM_MENTOR],
    [MENU.BACK],
  ]).resize();

const supportsMenu = () =>
  Markup.keyboard([[MENU.ADD_SUPPORT, MENU.REMOVE_SUPPORT], [MENU.BACK]]).resize();

const mentorsMenu = () =>
  Markup.keyboard([[MENU.ADD_MENTOR, MENU.REMOVE_MENTOR], [MENU.BACK]]).resize();

const mentorReturnMenu = () =>
  Markup.keyboard([[MENU.RETURN_ALL, MENU.RETURN_PICK], [MENU.BACK]]).resize();

const cancelMenu = () => Markup.keyboard([[MENU.CANCEL]]).resize();

const destMenu = () =>
  Markup.keyboard([[MENU.DEST_COWORKING, MENU.DEST_MENTOR], [MENU.CANCEL]]).resize();

const takeQtyMenu = () =>
  Markup.keyboard([[MENU.TAKE_ALL, MENU.TAKE_CUSTOM], [MENU.CANCEL]]).resize();

const returnDestMenu = () =>
  Markup.keyboard([[MENU.TO_WAREHOUSE, MENU.TO_COWORKING], [MENU.CANCEL]]).resize();

function menuForRole(role) {
  if (role === 'admin') return adminMainMenu();
  if (role === 'support') return supportMainMenu();
  if (role === 'mentor') return mentorMainMenu();
  return Markup.removeKeyboard();
}

function supportSelectInline(supports, prefix) {
  const rows = supports.map((s) => [
    Markup.button.callback(s.name || String(s.telegramId), `${prefix}:${s.telegramId}`),
  ]);
  rows.push([Markup.button.callback(MENU.CANCEL, `${prefix}:cancel`)]);
  return Markup.inlineKeyboard(rows);
}

function mentorSelectInline(mentors, prefix) {
  const rows = mentors.map((m) => {
    const group = m.groupName ? ` (${m.groupName})` : '';
    const total = (m.warehouseHoldings || 0) + (m.coworkingHoldings || 0);
    const count = total > 0 ? ` — ${total} шт.` : '';
    return [Markup.button.callback(`${m.name}${group}${count}`, `${prefix}:${m.telegramId}`)];
  });
  rows.push([Markup.button.callback(MENU.CANCEL, `${prefix}:cancel`)]);
  return Markup.inlineKeyboard(rows);
}

function qtyInline(maxQty, prefix) {
  const limit = Math.min(maxQty, 20);
  const rows = [];
  const buttons = [];
  for (let i = 1; i <= limit; i++) {
    buttons.push(Markup.button.callback(String(i), `${prefix}:${i}`));
    if (buttons.length === 5) {
      rows.push([...buttons]);
      buttons.length = 0;
    }
  }
  if (buttons.length) rows.push(buttons);
  rows.push([Markup.button.callback(MENU.CANCEL, `${prefix}:cancel`)]);
  return Markup.inlineKeyboard(rows);
}

module.exports = {
  adminMainMenu,
  supportMainMenu,
  mentorMainMenu,
  warehouseAdminMenu,
  warehouseSupportMenu,
  supportsMenu,
  mentorsMenu,
  mentorReturnMenu,
  cancelMenu,
  destMenu,
  returnDestMenu,
  takeQtyMenu,
  menuForRole,
  supportSelectInline,
  mentorSelectInline,
  qtyInline,
};
