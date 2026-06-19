const { SupportUser } = require('../models');

async function addSupport({ telegramId, name, createdBy }) {
  const id = Number(telegramId);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error('Некорректный Telegram ID');
  }

  const [support, created] = await SupportUser.findOrCreate({
    where: { telegramId: id },
    defaults: { telegramId: id, name: name || null, createdBy, isActive: true },
  });

  if (!created) {
    if (support.isActive) {
      throw new Error(`Супорт с ID ${id} уже назначен`);
    }
    support.isActive = true;
    if (name) support.name = name;
    await support.save();
  }

  return support;
}

async function removeSupport(telegramId) {
  const id = Number(telegramId);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error('Некорректный Telegram ID');
  }

  const support = await SupportUser.findOne({ where: { telegramId: id, isActive: true } });
  if (!support) {
    throw new Error(`Супорт с ID ${id} не найден`);
  }

  support.isActive = false;
  await support.save();
  return support;
}

async function listSupports() {
  return SupportUser.findAll({
    where: { isActive: true },
    order: [['createdAt', 'ASC']],
  });
}

function formatSupportList(supports) {
  if (!supports.length) {
    return '👥 Супорты не назначены.';
  }

  const lines = supports.map((s) => {
    const label = s.name ? `${s.name} (${s.telegramId})` : String(s.telegramId);
    return `• ${label}`;
  });

  return ['👥 Супорты:', '', ...lines].join('\n');
}

module.exports = {
  addSupport,
  removeSupport,
  listSupports,
  formatSupportList,
};
