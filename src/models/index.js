const { Sequelize } = require('sequelize');
const config = require('../config/database');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  dbConfig
);

const Student = require('./Student')(sequelize, Sequelize.DataTypes);
const Laptop = require('./Laptop')(sequelize, Sequelize.DataTypes);
const Transaction = require('./Transaction')(sequelize, Sequelize.DataTypes);

Student.hasMany(Transaction, { foreignKey: 'student_id', as: 'transactions' });
Transaction.belongsTo(Student, { foreignKey: 'student_id', as: 'student' });

Laptop.hasMany(Transaction, { foreignKey: 'laptop_id', as: 'transactions' });
Transaction.belongsTo(Laptop, { foreignKey: 'laptop_id', as: 'laptop' });

module.exports = {
  sequelize,
  Sequelize,
  Student,
  Laptop,
  Transaction,
};
