const { Op } = require('sequelize');
const { Laptop, Transaction, Student } = require('../models');
const { parseLaptopNumbers } = require('./issueService');
const { formatTime } = require('../utils/date');

async function getActiveLaptopIds() {
  const rows = await Transaction.findAll({
    where: { returnedAt: null },
    attributes: ['laptopId'],
    raw: true,
  });
  return rows.map((row) => row.laptopId);
}

async function addLaptops(numbersInput) {
  const numbers = parseLaptopNumbers(numbersInput);
  if (!numbers.length) {
    throw new Error('Введите номера ноутбуков через пробел или запятую');
  }

  const added = [];
  const errors = [];

  for (const number of numbers) {
    try {
      const existing = await Laptop.findOne({ where: { number } });
      if (existing) {
        if (existing.isActive) {
          throw new Error(`уже добавлен`);
        }
        existing.isActive = true;
        await existing.save();
        added.push(existing);
        continue;
      }

      const laptop = await Laptop.create({ number, isActive: true });
      added.push(laptop);
    } catch (err) {
      errors.push(`№${number}: ${err.message}`);
    }
  }

  if (!added.length) {
    throw new Error(errors.join('\n'));
  }

  return { added, errors };
}

async function listAllLaptops() {
  return Laptop.findAll({
    where: { isActive: true },
    order: [['number', 'ASC']],
  });
}

async function getFreeLaptops() {
  const activeIds = await getActiveLaptopIds();
  const where = { isActive: true };

  if (activeIds.length) {
    where.id = { [Op.notIn]: activeIds };
  }

  return Laptop.findAll({
    where,
    order: [['number', 'ASC']],
  });
}

async function getOccupiedLaptops() {
  return Transaction.findAll({
    where: { returnedAt: null },
    include: [
      { model: Student, as: 'student' },
      { model: Laptop, as: 'laptop' },
    ],
    order: [[{ model: Laptop, as: 'laptop' }, 'number', 'ASC']],
  });
}

async function getLaptopStats() {
  const laptops = await listAllLaptops();
  const activeIds = await getActiveLaptopIds();
  const occupied = activeIds.length;
  const free = laptops.length - occupied;
  return { total: laptops.length, free, occupied };
}

function formatLaptopListInChat(laptops, activeIds, occupiedMap) {
  if (!laptops.length) {
    return '🖥 Ноутбуков нет. Добавьте через «➕ Добавить ноут».';
  }

  const activeSet = new Set(activeIds);
  const lines = laptops.map((laptop) => {
    if (activeSet.has(laptop.id)) {
      const who = occupiedMap.get(laptop.id) || 'занят';
      return `• №${laptop.number} — занят (${who})`;
    }
    return `• №${laptop.number} — свободен`;
  });

  return lines.join('\n');
}

async function formatAllLaptopsInChat() {
  const laptops = await listAllLaptops();
  const activeIds = await getActiveLaptopIds();
  const transactions = await getOccupiedLaptops();
  const occupiedMap = new Map();

  for (const t of transactions) {
    occupiedMap.set(t.laptopId, t.recipientType === 'teacher' ? `${t.student.name} (учитель)` : t.student.name);
  }

  const stats = {
    total: laptops.length,
    free: laptops.length - activeIds.length,
    occupied: activeIds.length,
  };

  const header = `🖥 Ноутбуки: всего ${stats.total} | свободно ${stats.free} | не возвращено ${stats.occupied}`;
  const body = formatLaptopListInChat(laptops, activeIds, occupiedMap);

  return `${header}\n\n${body}`;
}

function laptopSelectInline(laptops, prefix = 'issue:laptop') {
  const { Markup } = require('telegraf');
  const rows = laptops.map((laptop) => [
    Markup.button.callback(`№${laptop.number}`, `${prefix}:${laptop.id}`),
  ]);
  rows.push([Markup.button.callback('❌ Отмена', `${prefix}:cancel`)]);
  return Markup.inlineKeyboard(rows);
}

function laptopMultiSelectInline(laptops, selected, prefix) {
  const { Markup } = require('telegraf');
  const rows = [];

  for (let i = 0; i < laptops.length; i += 3) {
    const chunk = laptops.slice(i, i + 3).map((laptop) => {
      const mark = selected.includes(laptop.number) ? '✅ ' : '';
      return Markup.button.callback(`${mark}№${laptop.number}`, `${prefix}:toggle:${laptop.number}`);
    });
    rows.push(chunk);
  }

  rows.push([
    Markup.button.callback('✅ Готово', `${prefix}:confirm`),
    Markup.button.callback('❌ Отмена', `${prefix}:cancel`),
  ]);

  return Markup.inlineKeyboard(rows);
}

function formatFreeLaptopsInChat(laptops) {
  if (!laptops.length) return '🟢 Свободных ноутбуков нет.';
  const numbers = laptops.map((l) => `№${l.number}`).join(', ');
  return `🟢 Свободные (${laptops.length}):\n\n${numbers}`;
}

function formatOccupiedLaptops(transactions) {
  if (!transactions.length) {
    return '💻 Все ноутбуки свободны.';
  }

  const lines = transactions.map((transaction) => {
    const who =
      transaction.recipientType === 'teacher'
        ? `${transaction.student.name} (учитель)`
        : transaction.student.name;
    return `• №${transaction.laptop.number} — ${who} (с ${formatTime(transaction.issuedAt)})`;
  });

  return ['💻 Занятые ноутбуки:', '', ...lines].join('\n');
}

function formatAllLaptops(laptops, activeIds) {
  if (!laptops.length) {
    return '🖥 Ноутбуки не добавлены.\n\nДобавьте их через «➕ Добавить ноутбуки».';
  }

  const activeSet = new Set(activeIds);
  const lines = laptops.map((laptop) => {
    const status = activeSet.has(laptop.id) ? 'занят' : 'свободен';
    return `• №${laptop.number} — ${status}`;
  });

  return ['🖥 Все ноутбуки:', '', ...lines].join('\n');
}

function laptopButtonLabel(laptop) {
  return `№${laptop.number}`;
}

function findLaptopByButton(laptops, text) {
  const normalized = text.trim().replace(/^№/, '');
  return laptops.find((laptop) => laptop.number === normalized || laptopButtonLabel(laptop) === text);
}

module.exports = {
  addLaptops,
  listAllLaptops,
  getFreeLaptops,
  getOccupiedLaptops,
  formatFreeLaptops: formatFreeLaptopsInChat,
  formatFreeLaptopsInChat,
  formatAllLaptopsInChat,
  formatLaptopListInChat,
  getLaptopStats,
  laptopSelectInline,
  laptopMultiSelectInline,
  formatOccupiedLaptops,
  formatAllLaptops,
  laptopButtonLabel,
  findLaptopByButton,
  getActiveLaptopIds,
};
