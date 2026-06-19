const { Markup } = require('telegraf');
const { teacherReturnButtonLabel } = require('../services/issueService');

const adminMenu = () =>
  Markup.keyboard([
    ['📤 Выдать ноутбук', '📥 Вернуть ноутбук'],
    ['📤 Выдать учителю', '📥 Вернуть от учителя'],
    ['📅 Сегодня', '⏳ Не возвращены'],
    ['💻 По номеру ноутбука', '👥 Супорты'],
  ]).resize();

const supportMenu = () =>
  Markup.keyboard([['📤 Выдать ноутбук', '📥 Вернуть ноутбук']]).resize();

const cancelMenu = () => Markup.keyboard([['❌ Отмена']]).resize();

const supportManageMenu = () =>
  Markup.keyboard([['➕ Добавить супорта', '➖ Удалить супорта'], ['◀️ Назад']]).resize();

function teacherReturnMenu(teachers) {
  const rows = [];

  for (let i = 0; i < teachers.length; i += 2) {
    rows.push(teachers.slice(i, i + 2).map((teacher) => teacherReturnButtonLabel(teacher)));
  }

  rows.push(['❌ Отмена']);
  return Markup.keyboard(rows).resize();
}

function menuForRole(role) {
  if (role === 'admin') return adminMenu();
  return supportMenu();
}

module.exports = {
  adminMenu,
  supportMenu,
  mainMenu: adminMenu,
  cancelMenu,
  supportManageMenu,
  teacherReturnMenu,
  menuForRole,
};
