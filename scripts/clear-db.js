#!/usr/bin/env node
require('dotenv').config();

const { sequelize } = require('../src/models');

async function clearDatabase() {
  await sequelize.authenticate();
  console.log('Очистка базы данных...');

  await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  await sequelize.query('TRUNCATE TABLE transactions');
  await sequelize.query('TRUNCATE TABLE support_users');
  await sequelize.query('TRUNCATE TABLE students');
  await sequelize.query('TRUNCATE TABLE laptops');
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

  console.log('✅ База очищена: transactions, support_users, students, laptops');
  await sequelize.close();
}

clearDatabase().catch((err) => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});
