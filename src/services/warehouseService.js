const { Settings, MentorUser, sequelize } = require('../models');

async function getSetting(key) {
  const row = await Settings.findOne({ where: { key } });
  return row ? row.value : 0;
}

async function setSetting(key, value) {
  const [row] = await Settings.findOrCreate({
    where: { key },
    defaults: { key, value },
  });
  row.value = value;
  await row.save();
  return row;
}

async function getTotalMentorHoldings() {
  const mentors = await MentorUser.findAll({ where: { isActive: true } });
  return mentors.reduce(
    (sum, m) => sum + m.warehouseHoldings + (m.coworkingHoldings || 0),
    0
  );
}

async function getOutsideWarehouseCount() {
  const coworking = await getSetting('coworking_count');
  const mentors = await getTotalMentorHoldings();
  return coworking + mentors;
}

async function getWarehouseStats() {
  const total = await getSetting('warehouse_total');
  const available = await getSetting('warehouse_available');
  const coworking = await getSetting('coworking_count');
  const withMentors = await getTotalMentorHoldings();
  return { total, available, coworking, withMentors };
}

async function setWarehouseTotal(count) {
  const newTotal = Number(count);
  if (!Number.isFinite(newTotal) || newTotal < 0) {
    throw new Error('Введите корректное количество (0 или больше)');
  }

  const outside = await getOutsideWarehouseCount();
  if (newTotal < outside) {
    throw new Error(
      `Нельзя установить ${newTotal}: ${outside} ноутов уже на коворкинге или у менторов`
    );
  }

  const newAvailable = newTotal - outside;
  await setSetting('warehouse_total', newTotal);
  await setSetting('warehouse_available', newAvailable);

  return { total: newTotal, available: newAvailable };
}

async function moveToCoworking({ count }) {
  const qty = Number(count);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error('Введите количество больше 0');
  }

  const available = await getSetting('warehouse_available');
  if (available < qty) {
    throw new Error(`На складе только ${available} ноутов`);
  }

  const coworking = await getSetting('coworking_count');
  await setSetting('warehouse_available', available - qty);
  await setSetting('coworking_count', coworking + qty);

  return { moved: qty };
}

async function moveToWarehouse({ count }) {
  const qty = Number(count);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error('Введите количество больше 0');
  }

  const coworking = await getSetting('coworking_count');
  if (coworking < qty) {
    throw new Error(`На коворкинге только ${coworking} ноутов`);
  }

  const available = await getSetting('warehouse_available');
  await setSetting('coworking_count', coworking - qty);
  await setSetting('warehouse_available', available + qty);

  return { moved: qty };
}

async function giveToMentor({ count, mentorTelegramId, className }) {
  const qty = Number(count);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error('Некорректное количество');
  }

  const mentor = await MentorUser.findOne({
    where: { telegramId: mentorTelegramId, isActive: true },
  });
  if (!mentor) {
    throw new Error('Ментор не найден');
  }

  const available = await getSetting('warehouse_available');
  if (available < qty) {
    throw new Error(`На складе только ${available} ноутов`);
  }

  mentor.warehouseHoldings = (mentor.warehouseHoldings || 0) + qty;
  if (className?.trim()) {
    mentor.groupName = className.trim();
  }
  await mentor.save();
  await setSetting('warehouse_available', available - qty);

  return { mentor, count: qty };
}

async function takeFromMentor({ mentorTelegramId, count, destination }) {
  const qty = Number(count);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error('Некорректное количество');
  }
  if (!['warehouse', 'coworking'].includes(destination)) {
    throw new Error('Некорректное назначение');
  }

  const mentor = await MentorUser.findOne({
    where: { telegramId: mentorTelegramId, isActive: true },
  });
  if (!mentor) {
    throw new Error('Ментор не найден');
  }

  const total = (mentor.warehouseHoldings || 0) + (mentor.coworkingHoldings || 0);
  if (qty > total) {
    throw new Error(`У ментора только ${total} ноутов`);
  }

  const whTake = Math.min(qty, mentor.warehouseHoldings || 0);
  const cwTake = qty - whTake;
  mentor.warehouseHoldings = (mentor.warehouseHoldings || 0) - whTake;
  mentor.coworkingHoldings = (mentor.coworkingHoldings || 0) - cwTake;
  await mentor.save();

  if (destination === 'warehouse') {
    const available = await getSetting('warehouse_available');
    await setSetting('warehouse_available', available + qty);
  } else {
    const coworking = await getSetting('coworking_count');
    await setSetting('coworking_count', coworking + qty);
  }

  return { mentor, count: qty, destination };
}

async function formatFullInfo() {
  const stats = await getWarehouseStats();
  const mentors = await MentorUser.findAll({
    where: { isActive: true },
    order: [['name', 'ASC']],
  });

  const lines = [
    '📊 Информация',
    '',
    `📦 Склад: ${stats.available} / ${stats.total}`,
    `🏢 Коворкинг: ${stats.coworking} шт.`,
    '',
    '👨‍🏫 Менторы:',
  ];

  if (!mentors.length) {
    lines.push('— нет менторов');
  } else {
    for (const m of mentors) {
      const total = (m.warehouseHoldings || 0) + (m.coworkingHoldings || 0);
      const group = m.groupName ? ` (${m.groupName})` : '';
      lines.push(`• ${m.name}${group} — ${total} шт.`);
    }
  }

  return lines.join('\n');
}

function formatWarehouseStatus(stats) {
  return (
    `📦 Склад: ${stats.available} / ${stats.total}\n` +
    `🏢 Коворкинг: ${stats.coworking} шт.\n` +
    `👨‍🏫 У менторов: ${stats.withMentors} шт.`
  );
}

module.exports = {
  getSetting,
  setSetting,
  getWarehouseStats,
  setWarehouseTotal,
  moveToCoworking,
  moveToWarehouse,
  giveToMentor,
  takeFromMentor,
  formatFullInfo,
  formatWarehouseStatus,
  getTotalMentorHoldings,
};
