const { Markup } = require('telegraf');
const { MENU } = require('./constants');

const adminMainMenu = () =>
  Markup.keyboard([
    [MENU.LAPTOPS, MENU.TEACHERS],
    [MENU.STUDENTS, MENU.OCCUPIED],
    [MENU.SUPPORTS],
  ]).resize();

const supportMainMenu = () =>
  Markup.keyboard([
    [MENU.LAPTOPS, MENU.TEACHERS],
    [MENU.STUDENTS, MENU.OCCUPIED],
  ]).resize();

const laptopsMenu = (isAdmin) => {
  const rows = isAdmin ? [[MENU.ADD_LAPTOP], [MENU.LAPTOP_OCCUPIED]] : [[MENU.LAPTOP_OCCUPIED]];
  rows.push([MENU.ISSUE_LAPTOP, MENU.RETURN_LAPTOP], [MENU.BACK]);
  return Markup.keyboard(rows).resize();
};

const teachersMenu = (isAdmin) => {
  const rows = isAdmin ? [[MENU.ADD_TEACHER]] : [];
  rows.push([MENU.TEACHER_ISSUE, MENU.TEACHER_RETURN], [MENU.BACK]);
  return Markup.keyboard(rows).resize();
};

const teacherReturnMenu = () =>
  Markup.keyboard([[MENU.RETURN_ALL, MENU.RETURN_PICK], [MENU.BACK]]).resize();

const studentsMenu = (isAdmin) => {
  const rows = isAdmin ? [[MENU.ADD_STUDENT], [MENU.STUDENT_LIST]] : [[MENU.STUDENT_LIST]];
  rows.push([MENU.BACK]);
  return Markup.keyboard(rows).resize();
};

const supportsMenu = () =>
  Markup.keyboard([[MENU.ADD_SUPPORT, MENU.REMOVE_SUPPORT], [MENU.BACK]]).resize();

const cancelMenu = () => Markup.keyboard([[MENU.CANCEL]]).resize();

function menuForRole(role) {
  if (role === 'admin') return adminMainMenu();
  return supportMainMenu();
}

function studentSelectInline(students) {
  const rows = students.map((student) => [
    Markup.button.callback(student.name, `issue:student:${student.id}`),
  ]);
  rows.push([Markup.button.callback(MENU.CANCEL, 'issue:student:cancel')]);
  return Markup.inlineKeyboard(rows);
}

function teacherSelectInline(teachers, prefix) {
  const rows = teachers.map((t) => [
    Markup.button.callback(`${t.name} (${t.count})`, `${prefix}:${t.studentId}`),
  ]);
  rows.push([Markup.button.callback(MENU.CANCEL, `${prefix}:cancel`)]);
  return Markup.inlineKeyboard(rows);
}

module.exports = {
  adminMainMenu,
  supportMainMenu,
  laptopsMenu,
  teachersMenu,
  teacherReturnMenu,
  studentsMenu,
  supportsMenu,
  cancelMenu,
  menuForRole,
  studentSelectInline,
  teacherSelectInline,
};
