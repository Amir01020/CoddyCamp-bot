'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('transactions', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      student_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'students', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      laptop_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'laptops', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      issued_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      returned_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      issued_by: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      returned_by: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('transactions', ['laptop_id', 'returned_at'], {
      name: 'idx_transactions_laptop_returned',
    });
    await queryInterface.addIndex('transactions', ['issued_at'], {
      name: 'idx_transactions_issued_at',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('transactions');
  },
};
