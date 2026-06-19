'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('transactions', 'recipient_type', {
      type: Sequelize.ENUM('student', 'teacher'),
      allowNull: false,
      defaultValue: 'student',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('transactions', 'recipient_type');
  },
};
