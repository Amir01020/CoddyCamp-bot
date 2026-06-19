const { Student, Laptop, Transaction, sequelize } = require('../models');

function formatRecipient(transaction) {
  const label = transaction.recipientType === 'teacher' ? 'Учитель' : 'Ученик';
  return `${label}: ${transaction.student.name}`;
}

async function issueLaptop({ studentName, laptopNumber, adminId, recipientType = 'student' }) {
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
      const who =
        activeIssue.recipientType === 'teacher'
          ? `учителю ${activeIssue.student.name}`
          : `ученику ${activeIssue.student.name}`;
      throw new Error(`Ноутбук №${number} уже выдан ${who} и не возвращён`);
    }

    const transaction = await Transaction.create(
      {
        studentId: student.id,
        laptopId: laptop.id,
        issuedAt: new Date(),
        issuedBy: adminId,
        recipientType,
      },
      { transaction: t }
    );

    transaction.student = student;
    transaction.laptop = laptop;

    return { transaction, student, laptop };
  });
}

function parseLaptopNumbers(input) {
  return [...new Set(input.split(/[\s,;]+/).map((n) => n.trim()).filter(Boolean))];
}

async function issueTeacherLaptops({ teacherName, laptopNumbersInput, adminId }) {
  const name = teacherName.trim();
  if (!name) throw new Error('Введите имя учителя');

  const numbers = parseLaptopNumbers(laptopNumbersInput);
  if (!numbers.length) throw new Error('Введите номера ноутбуков через пробел или запятую');

  const issued = [];
  const errors = [];

  for (const number of numbers) {
    try {
      const result = await issueLaptop({
        studentName: name,
        laptopNumber: number,
        adminId,
        recipientType: 'teacher',
      });
      issued.push(result);
    } catch (err) {
      errors.push(`№${number}: ${err.message}`);
    }
  }

  if (!issued.length) {
    throw new Error(errors.join('\n'));
  }

  return { issued, errors, teacherName: name };
}

async function getTeachersWithActiveLaptops() {
  const transactions = await Transaction.findAll({
    where: { returnedAt: null, recipientType: 'teacher' },
    include: [
      { model: Student, as: 'student' },
      { model: Laptop, as: 'laptop' },
    ],
    order: [['issuedAt', 'ASC']],
  });

  const byTeacher = new Map();

  for (const transaction of transactions) {
    const id = transaction.studentId;
    if (!byTeacher.has(id)) {
      byTeacher.set(id, {
        studentId: id,
        name: transaction.student.name,
        laptops: [],
      });
    }
    byTeacher.get(id).laptops.push(transaction.laptop.number);
  }

  return Array.from(byTeacher.values()).map((teacher) => ({
    ...teacher,
    count: teacher.laptops.length,
  }));
}

function teacherReturnButtonLabel(teacher) {
  return `${teacher.name} (${teacher.count})`;
}

function findTeacherByButton(options, text) {
  return options.find((teacher) => teacherReturnButtonLabel(teacher) === text);
}

async function returnTeacherLaptops({ teacherName, studentId, adminId }) {
  return sequelize.transaction(async (t) => {
    let student;

    if (studentId) {
      student = await Student.findByPk(studentId, { transaction: t });
    } else {
      const name = teacherName?.trim();
      if (!name) throw new Error('Выберите учителя');
      student = await Student.findOne({ where: { name }, transaction: t });
    }

    if (!student) {
      throw new Error('У выбранного учителя нет не возвращённых ноутбуков');
    }

    const activeIssues = await Transaction.findAll({
      where: {
        studentId: student.id,
        returnedAt: null,
        recipientType: 'teacher',
      },
      include: [{ model: Laptop, as: 'laptop' }],
      order: [['issuedAt', 'ASC']],
      transaction: t,
    });

    if (!activeIssues.length) {
      throw new Error(`У учителя ${student.name} нет не возвращённых ноутбуков`);
    }

    const now = new Date();
    for (const issue of activeIssues) {
      issue.returnedAt = now;
      issue.returnedBy = adminId;
      await issue.save({ transaction: t });
    }

    return { teacherName: student.name, returned: activeIssues };
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
  issueTeacherLaptops,
  returnLaptop,
  returnTeacherLaptops,
  getTeachersWithActiveLaptops,
  teacherReturnButtonLabel,
  findTeacherByButton,
  formatRecipient,
};
