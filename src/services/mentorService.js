const { MentorUser } = require('../models');

async function addMentor({ telegramId, name, groupName, createdBy }) {
  const id = Number(telegramId);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error('Некорректный Telegram ID');
  }
  if (!name?.trim()) {
    throw new Error('Введите имя ментора');
  }

  const [mentor, created] = await MentorUser.findOrCreate({
    where: { telegramId: id },
    defaults: {
      telegramId: id,
      name: name.trim(),
      groupName: groupName?.trim() || null,
      createdBy,
      isActive: true,
    },
  });

  if (!created) {
    if (mentor.isActive) {
      throw new Error(`Ментор с ID ${id} уже добавлен`);
    }
    mentor.isActive = true;
    mentor.name = name.trim();
    if (groupName) mentor.groupName = groupName.trim();
    await mentor.save();
  }

  return mentor;
}

async function removeMentor(telegramId) {
  const id = Number(telegramId);
  const mentor = await MentorUser.findOne({ where: { telegramId: id, isActive: true } });
  if (!mentor) {
    throw new Error(`Ментор с ID ${id} не найден`);
  }

  const holdings = await getMentorHoldings(id);
  if (holdings.total > 0) {
    throw new Error(`У ментора ${holdings.total} ноутов. Сначала верните их.`);
  }

  mentor.isActive = false;
  await mentor.save();
  return mentor;
}

async function listMentors() {
  return MentorUser.findAll({
    where: { isActive: true },
    order: [['createdAt', 'ASC']],
  });
}

async function getMentorByTelegramId(telegramId) {
  return MentorUser.findOne({
    where: { telegramId, isActive: true },
  });
}

async function getMentorHoldings(telegramId) {
  const mentor = await getMentorByTelegramId(telegramId);
  if (!mentor) {
    return { warehouse: 0, coworking: 0, total: 0, mentor: null };
  }

  const warehouse = mentor.warehouseHoldings || 0;
  const coworking = mentor.coworkingHoldings || 0;

  return {
    mentor,
    warehouse,
    coworking,
    total: warehouse + coworking,
  };
}

function formatMentorList(mentors) {
  if (!mentors.length) {
    return '👨‍🏫 Менторы не добавлены.';
  }
  const lines = mentors.map((m) => {
    const group = m.groupName ? `, ${m.groupName}` : '';
    return `• ${m.name}${group} (${m.telegramId})`;
  });
  return ['👨‍🏫 Менторы:', '', ...lines].join('\n');
}

function formatMentorHoldings(holdings) {
  if (!holdings.total) {
    return '📋 У вас нет ноутбуков.';
  }
  const lines = [];
  if (holdings.warehouse > 0) {
    lines.push(`📦 Со склада: ${holdings.warehouse} шт.`);
  }
  if (holdings.coworking > 0) {
    lines.push(`🏢 С коворкинга: ${holdings.coworking} шт.`);
  }
  return `📋 Ваши ноутбуки (${holdings.total}):\n\n${lines.join('\n')}`;
}

function splitReturnQty(holdings, qty) {
  const wh = Math.min(qty, holdings.warehouse);
  const cw = qty - wh;
  return { warehouseQuantity: wh, coworkingQuantity: cw };
}

module.exports = {
  addMentor,
  removeMentor,
  listMentors,
  getMentorByTelegramId,
  getMentorHoldings,
  formatMentorList,
  formatMentorHoldings,
  splitReturnQty,
};
