'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('settings', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      key: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
      },
      value: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
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

    await queryInterface.bulkInsert('settings', [
      { key: 'warehouse_total', value: 0, created_at: new Date(), updated_at: new Date() },
      { key: 'warehouse_available', value: 0, created_at: new Date(), updated_at: new Date() },
    ]);

    await queryInterface.addColumn('laptops', 'in_coworking', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.createTable('mentor_users', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      telegram_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        unique: true,
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      group_name: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      warehouse_holdings: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      created_by: {
        type: Sequelize.BIGINT,
        allowNull: false,
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

    await queryInterface.changeColumn('transactions', 'recipient_type', {
      type: Sequelize.ENUM('student', 'teacher', 'mentor'),
      allowNull: false,
      defaultValue: 'student',
    });

    await queryInterface.createTable('laptop_requests', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      mentor_telegram_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      mentor_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      group_name: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('pending', 'accepted', 'fulfilled', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending',
      },
      accepted_by: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      accepted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      warehouse_quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      coworking_quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      fulfilled_at: {
        type: Sequelize.DATE,
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

    await queryInterface.createTable('return_requests', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      mentor_telegram_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      mentor_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      support_telegram_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      warehouse_quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      coworking_laptop_ids: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: '[]',
      },
      status: {
        type: Sequelize.ENUM('pending', 'accepted', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
      },
      responded_at: {
        type: Sequelize.DATE,
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

    await queryInterface.createTable('request_notifications', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      request_type: {
        type: Sequelize.ENUM('laptop_request', 'return_request'),
        allowNull: false,
      },
      request_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      telegram_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      chat_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      message_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
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
  },

  async down(queryInterface) {
    await queryInterface.dropTable('request_notifications');
    await queryInterface.dropTable('return_requests');
    await queryInterface.dropTable('laptop_requests');
    await queryInterface.changeColumn('transactions', 'recipient_type', {
      type: Sequelize.ENUM('student', 'teacher'),
      allowNull: false,
      defaultValue: 'student',
    });
    await queryInterface.dropTable('mentor_users');
    await queryInterface.removeColumn('laptops', 'in_coworking');
    await queryInterface.dropTable('settings');
  },
};
