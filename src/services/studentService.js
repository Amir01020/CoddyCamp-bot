const { Op } = require('sequelize');
const { Student, Transaction, Laptop } = require('../models');

function activeStudentWhere() {
  return {
    isAllowed: true,
    activeUntil: { [Op.gt]: new Date() },
  };
}

function managedStudentWhere() {
  return { isAllowed: true };
}

function parseDays(input) {
  const text = input.trim().toLowerCase().replace(',', '.');

  const monthMatch = text.match(/^(\d+)\s*м(ес)?$/);
  if (monthMatch) {
    const months = Number(monthMatch[1]);
    if (!Number.isInteger(months) || months <= 0) {
      throw new Error('Введите корректное количество месяцев');
    }
    return months * 30;
  }

  const days = Number(text.replace(/\s*д(ней|ня|ень)?\.?$/, '').trim());
  if (!Number.isInteger(days) || days <= 0) {
    throw new Error('Введите количество дней (например: 30) или месяцев (например: 1м)');
  }

  return days;
}

function addDays(fromDate, days) {
  const result = new Date(fromDate);
  result.setDate(result.getDate() + days);
  return result;
}

function isStudentActive(student) {
  if (!student?.isAllowed || !student.activeUntil) return false;
  return student.activeUntil > new Date();
}

function formatActiveUntil(date) {
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

async function addAllowedStudent(name, daysInput) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Введите имя ученика');

  const days = parseDays(daysInput);
  const activeUntil = addDays(new Date(), days);

  const [student, created] = await Student.findOrCreate({
    where: { name: trimmed },
    defaults: { name: trimmed, isAllowed: true, activeUntil },
  });

  if (!created) {
    student.isAllowed = true;
    student.activeUntil = activeUntil;
    await student.save();
  }

  return { student, days };
}

async function extendStudentDays(studentId, daysInput) {
  const student = await Student.findOne({
    where: { id: studentId, ...managedStudentWhere() },
  });
  if (!student) throw new Error('Ученик не найден');

  const days = parseDays(daysInput);
  const base =
    student.activeUntil && student.activeUntil > new Date() ? student.activeUntil : new Date();
  student.activeUntil = addDays(base, days);
  student.isAllowed = true;
  await student.save();

  return { student, days };
}

async function removeStudent(studentId) {
  const student = await Student.findOne({
    where: { id: studentId, ...managedStudentWhere() },
  });
  if (!student) throw new Error('Ученик не найден');

  student.isAllowed = false;
  await student.save();
  return student;
}

async function listAllowedStudents() {
  return Student.findAll({
    where: activeStudentWhere(),
    order: [['activeUntil', 'ASC']],
  });
}

async function listManagedStudents() {
  return Student.findAll({
    where: managedStudentWhere(),
    order: [['name', 'ASC']],
  });
}

async function getAllowedStudentById(id) {
  return Student.findOne({ where: { id, ...activeStudentWhere() } });
}

async function getManagedStudentById(id) {
  return Student.findOne({ where: { id, ...managedStudentWhere() } });
}

function formatDaysLeft(activeUntil) {
  const ms = activeUntil - new Date();
  if (ms <= 0) return 'истёк';
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  if (days === 1) return '1 день';
  if (days < 5) return `${days} дня`;
  return `${days} дней`;
}

async function getStudentCurrentLaptop(studentId) {
  return Transaction.findOne({
    where: { studentId, returnedAt: null, recipientType: 'student' },
    include: [{ model: Laptop, as: 'laptop' }],
  });
}

async function formatStudentDetail(student) {
  const issue = await getStudentCurrentLaptop(student.id);
  const laptopText = issue ? `ноут №${issue.laptop.number}` : 'не пользуется';
  const active = isStudentActive(student);

  const timeBlock = active
    ? `⏳ Осталось: ${formatDaysLeft(student.activeUntil)}\n📅 Активен до: ${formatActiveUntil(student.activeUntil)}`
    : `⛔ Подписка истекла\n📅 Истёк: ${formatActiveUntil(student.activeUntil)}`;

  return `👨‍🎓 ${student.name}\n\n${timeBlock}\n💻 Сейчас: ${laptopText}`;
}

async function formatStudentsDetailedList(students, { forSupport = false } = {}) {
  if (!students.length) {
    return forSupport ? '👨‍🎓 Активных учеников нет.' : '👨‍🎓 Учеников нет.';
  }

  const lines = [];
  for (const student of students) {
    const issue = await getStudentCurrentLaptop(student.id);
    const laptopText = issue ? `ноут №${issue.laptop.number}` : 'не пользуется';
    const active = isStudentActive(student);
    const timeText = active
      ? `осталось ${formatDaysLeft(student.activeUntil)}`
      : 'подписка истекла';
    lines.push(`• ${student.name} — ${timeText}, ${laptopText}`);
  }

  const title = forSupport ? '👨‍🎓 Активные ученики:' : '👨‍🎓 Ученики:';
  return [title, '', ...lines].join('\n');
}

function studentManageListInline(students) {
  const { Markup } = require('telegraf');
  const rows = students.map((student) => {
    const label = isStudentActive(student) ? student.name : `${student.name} ⛔`;
    return [Markup.button.callback(label, `student:manage:${student.id}`)];
  });
  rows.push([Markup.button.callback('❌ Отмена', 'student:manage:cancel')]);
  return Markup.inlineKeyboard(rows);
}

function studentManageActionsInline(studentId) {
  const { Markup } = require('telegraf');
  return Markup.inlineKeyboard([
    [Markup.button.callback('➕ Добавить дни', `student:extend:${studentId}`)],
    [Markup.button.callback('🗑 Удалить ученика', `student:delete:${studentId}`)],
  ]);
}

module.exports = {
  addAllowedStudent,
  extendStudentDays,
  removeStudent,
  listAllowedStudents,
  listManagedStudents,
  getAllowedStudentById,
  getManagedStudentById,
  formatStudentsDetailedList,
  formatStudentDetail,
  formatDaysLeft,
  studentManageListInline,
  studentManageActionsInline,
  getStudentCurrentLaptop,
  isStudentActive,
  parseDays,
};
