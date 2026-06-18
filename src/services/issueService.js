const { Student, Laptop, Transaction, sequelize } = require('../models');

async function issueLaptop({ studentName, laptopNumber, adminId }) {
  return sequelize.transaction(async (t) => {
    const name = studentName.trim();
    const number = laptopNumber.trim();

    if (!name) throw new Error('Введите имя ученика');
    if (!number) throw new Error('Введите номер ноутбука');

    const [student] = await Student.findOrCreate({
      where: { name },
      defaults: { name },
      transaction: t,
    });

    const [laptop] = await Laptop.findOrCreate({
      where: { number },
      defaults: { number, isActive: true },
      transaction: t,
    });

    if (!laptop.isActive) {
      throw new Error(`Ноутбук №${number} отключён из учёта`);
    }

    const activeIssue = await Transaction.findOne({
      where: { laptopId: laptop.id, returnedAt: null },
      include: [{ model: Student, as: 'student' }],
      transaction: t,
    });

    if (activeIssue) {
      throw new Error(
        `Ноутбук №${number} уже выдан ученику ${activeIssue.student.name} и не возвращён`
      );
    }

    const transaction = await Transaction.create(
      {
        studentId: student.id,
        laptopId: laptop.id,
        issuedAt: new Date(),
        issuedBy: adminId,
      },
      { transaction: t }
    );

    return { transaction, student, laptop };
  });
}

async function returnLaptop({ laptopNumber, adminId }) {
  const number = laptopNumber.trim();
  if (!number) throw new Error('Введите номер ноутбука');

  const laptop = await Laptop.findOne({ where: { number } });
  if (!laptop) throw new Error(`Ноутбук №${number} не найден`);

  const activeIssue = await Transaction.findOne({
    where: { laptopId: laptop.id, returnedAt: null },
    include: [{ model: Student, as: 'student' }],
  });

  if (!activeIssue) {
    throw new Error(`Ноутбук №${number} сейчас никто не брал`);
  }

  activeIssue.returnedAt = new Date();
  activeIssue.returnedBy = adminId;
  await activeIssue.save();

  return { transaction: activeIssue, student: activeIssue.student, laptop };
}

module.exports = {
  issueLaptop,
  returnLaptop,
};
