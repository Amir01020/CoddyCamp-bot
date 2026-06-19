'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('students', 'is_allowed', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.sequelize.query(`
      UPDATE students s
      INNER JOIN transactions t ON t.student_id = s.id AND t.recipient_type = 'student'
      SET s.is_allowed = true
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('students', 'is_allowed');
  },
};
