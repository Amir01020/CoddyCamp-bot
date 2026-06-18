const { Op } = require('sequelize');
const { Transaction, Student, Laptop } = require('../models');
const { getTodayRange, formatTime } = require('../utils/date');

async function getTodayReport() {
  const { start, end } = getTodayRange();

  return Transaction.findAll({
    where: {
      issuedAt: { [Op.between]: [start, end] },
    },
    include: [
      { model: Student, as: 'student' },
      { model: Laptop, as: 'laptop' },
    ],
    order: [['issuedAt', 'ASC']],
  });
}

async function getLaptopTodayReport(laptopNumber) {
  const { start, end } = getTodayRange();
  const number = laptopNumber.trim();

  return Transaction.findAll({
    include: [
      { model: Student, as: 'student' },
      {
        model: Laptop,
        as: 'laptop',
        where: { number },
      },
    ],
    where: {
      issuedAt: { [Op.between]: [start, end] },
    },
    order: [['issuedAt', 'ASC']],
  });
}

async function getActiveIssues() {
  return Transaction.findAll({
    where: { returnedAt: null },
    include: [
      { model: Student, as: 'student' },
      { model: Laptop, as: 'laptop' },
    ],
    order: [['issuedAt', 'ASC']],
  });
}

function formatTodayReport(transactions) {
  if (!transactions.length) {
    return '📅 Сегодня ноутбуки ещё никто не брал.';
  }

  const returned = [];
  const active = [];

  for (const t of transactions) {
    const line = `• ${t.student.name} — ноут №${t.laptop.number} (с ${formatTime(t.issuedAt)})`;
    if (t.returnedAt) {
      returned.push(`${line} → вернул в ${formatTime(t.returnedAt)}`);
    } else {
      active.push(line);
    }
  }

  const parts = ['📅 Сегодня:'];

  if (returned.length) {
    parts.push('', '✅ Вернули:', ...returned);
  }

  if (active.length) {
    parts.push('', '⏳ Ещё не вернули:', ...active);
  }

  return parts.join('\n');
}

function formatLaptopReport(laptopNumber, transactions) {
  if (!transactions.length) {
    return `💻 Ноутбук №${laptopNumber} сегодня никто не брал.`;
  }

  const lines = transactions.map((t) => {
  const issued = `${formatTime(t.issuedAt)} — выдал ${t.student.name}`;
    if (t.returnedAt) {
      return `• ${issued} → вернул в ${formatTime(t.returnedAt)}`;
    }
    return `• ${issued} (ещё не вернул)`;
  });

  return [`💻 Ноутбук №${laptopNumber} сегодня:`, '', ...lines].join('\n');
}

function formatActiveReport(transactions) {
  if (!transactions.length) {
    return '✅ Сейчас все ноутбуки на месте.';
  }

  const lines = transactions.map(
    (t) => `• ${t.student.name} — ноут №${t.laptop.number} (с ${formatTime(t.issuedAt)})`
  );

  return ['⏳ Сейчас не возвращены:', '', ...lines].join('\n');
}

module.exports = {
  getTodayReport,
  getLaptopTodayReport,
  getActiveIssues,
  formatTodayReport,
  formatLaptopReport,
  formatActiveReport,
};
