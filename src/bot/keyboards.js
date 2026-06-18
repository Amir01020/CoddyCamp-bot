const { Markup } = require('telegraf');

const mainMenu = () =>
  Markup.keyboard([
    ['📤 Выдать ноутбук', '📥 Вернуть ноутбук'],
    ['📅 Сегодня', '⏳ Не возвращены'],
    ['💻 По номеру ноутбука'],
  ]).resize();

const cancelMenu = () => Markup.keyboard([['❌ Отмена']]).resize();

module.exports = {
  mainMenu,
  cancelMenu,
};
