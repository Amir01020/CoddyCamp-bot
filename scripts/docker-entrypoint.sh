#!/bin/sh
set -e

echo "Ожидание MySQL..."

until node -e "
const mysql = require('mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
  });
  await conn.ping();
  await conn.end();
})().then(() => process.exit(0)).catch(() => process.exit(1));
" 2>/dev/null; do
  sleep 2
done

echo "MySQL доступен. Запуск миграций..."
npx sequelize-cli db:migrate

echo "Запуск бота..."
exec node src/bot/index.js
