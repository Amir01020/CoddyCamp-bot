'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('settings', [
      { key: 'coworking_count', value: 0, created_at: new Date(), updated_at: new Date() },
    ]);

    await queryInterface.addColumn('mentor_users', 'coworking_holdings', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.addColumn('return_requests', 'coworking_quantity', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('return_requests', 'coworking_quantity');
    await queryInterface.removeColumn('mentor_users', 'coworking_holdings');
    await queryInterface.bulkDelete('settings', { key: 'coworking_count' });
  },
};
