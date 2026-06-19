const { Student, Laptop, Transaction, sequelize } = require('../models');
const { isStudentActive } = require('./studentService');

function formatRecipient(transaction) {
  const label = transaction.recipientType === 'teacher' ? 'Учитель' : 'Ученик';
  return `${label}: ${transaction.student.name}`;
}

function parseLaptopNumbers(input) {
  return [...new Set(input.split(/[\s,;]+/).map((n) => n.trim()).filter(Boolean))];
}

async function issueLaptop({
  studentId,
  studentName,
  laptopNumber,
  adminId,
  recipientType = 'student',
  requireAllowedStudent = true,
}) {
  return sequelize.transaction(async (t) => {
    const number = laptopNumber.trim().replace(/^№/, '');
    if (!number) throw new Error('Выберите или введите номер ноутбука');

    let student;

    if (studentId) {
      student = await Student.findByPk(studentId, { transaction: t });
    } else {
      const name = studentName?.trim();
      if (!name) throw new Error('Выберите ученика');
      student = await Student.findOne({ where: { name }, transaction: t });
    }

    if (!student) {
      throw new Error('Ученик не найден. Добавьте его в список учеников.');
    }

    if (recipientType === 'student' && requireAllowedStudent && !isStudentActive(student)) {
      throw new Error(`Ученик «${student.name}» неактивен или не в списке. Обратитесь к администратору.`);
    }

    const laptop = await Laptop.findOne({ where: { number }, transaction: t });
    if (!laptop || !laptop.isActive) {
      throw new Error(`Ноутбук №${number} не зарегистрирован. Обратитесь к администратору.`);
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

async function issueTeacherLaptops({ teacherName, laptopNumbersInput, adminId }) {
  const name = teacherName.trim();
  if (!name) throw new Error('Введите имя учителя');

  const numbers = parseLaptopNumbers(laptopNumbersInput);
  if (!numbers.length) throw new Error('Введите номера ноутбуков через пробел или запятую');

  const [student] = await Student.findOrCreate({
    where: { name },
    defaults: { name, isAllowed: false },
  });

  const issued = [];
  const errors = [];

  for (const number of numbers) {
    try {
      const result = await issueLaptop({
        studentId: student.id,
        laptopNumber: number,
        adminId,
        recipientType: 'teacher',
        requireAllowedStudent: false,
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

async function returnTeacherLaptopsPartial({ studentId, laptopNumbers, adminId }) {
  return sequelize.transaction(async (t) => {
    const student = await Student.findByPk(studentId, { transaction: t });
    if (!student) throw new Error('Учитель не найден');

    const numbers = [...new Set(laptopNumbers.map((n) => String(n).replace(/^№/, '').trim()))];
    if (!numbers.length) throw new Error('Выберите ноутбуки для возврата');

    const activeIssues = await Transaction.findAll({
      where: {
        studentId: student.id,
        returnedAt: null,
        recipientType: 'teacher',
      },
      include: [{ model: Laptop, as: 'laptop' }],
      transaction: t,
    });

    const toReturn = activeIssues.filter((issue) => numbers.includes(issue.laptop.number));
    if (!toReturn.length) {
      throw new Error('Выбранные ноутбуки не найдены у этого учителя');
    }

    const now = new Date();
    for (const issue of toReturn) {
      issue.returnedAt = now;
      issue.returnedBy = adminId;
      await issue.save({ transaction: t });
    }

    return { teacherName: student.name, returned: toReturn };
  });
}

async function issueTeacherLaptopsByNumbers({ teacherName, laptopNumbers, adminId }) {
  const numbers = [...new Set(laptopNumbers.map((n) => String(n).replace(/^№/, '').trim()))];
  if (!numbers.length) throw new Error('Выберите ноутбуки');

  return issueTeacherLaptops({
    teacherName,
    laptopNumbersInput: numbers.join(' '),
    adminId,
  });
}

async function returnLaptop({ laptopNumber, adminId }) {
  const number = laptopNumber.trim().replace(/^№/, '');
  if (!number) throw new Error('Введите номер ноутбука');

  const laptop = await Laptop.findOne({ where: { number, isActive: true } });
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
  returnTeacherLaptopsPartial,
  issueTeacherLaptopsByNumbers,
  getTeachersWithActiveLaptops,
  teacherReturnButtonLabel,
  findTeacherByButton,
  formatRecipient,
  parseLaptopNumbers,
};
