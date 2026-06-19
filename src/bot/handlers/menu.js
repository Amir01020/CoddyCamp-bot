const { MENU, STEPS } = require('../constants');
const { clearState } = require('../session');
const {
  menuForRole,
  laptopsMenu,
  teachersMenu,
  teacherReturnMenu,
  studentsMenu,
  supportsMenu,
  cancelMenu,
  studentSelectInline,
  teacherSelectInline,
} = require('../keyboards');
const { getUserRole, isAdmin } = require('../middlewares/isAdmin');
const laptopService = require('../../services/laptopService');
const studentService = require('../../services/studentService');
const supportService = require('../../services/supportService');
const {
  issueLaptop,
  returnLaptop,
  issueTeacherLaptopsByNumbers,
  returnTeacherLaptops,
  returnTeacherLaptopsPartial,
  getTeachersWithActiveLaptops,
  formatRecipient,
} = require('../../services/issueService');
const { Student } = require('../../models');

async function replyMain(ctx, text) {
  const role = await getUserRole(ctx.from.id);
  await ctx.reply(text, menuForRole(role));
}

async function replySubmenu(ctx, text, keyboard) {
  await ctx.reply(text, keyboard);
}

function ensureSession(ctx) {
  ctx.session = ctx.session || {};
  return ctx.session;
}

async function showStudentIssueList(ctx) {
  const students = await studentService.listAllowedStudents();
  if (!students.length) {
    await ctx.reply('❌ Нет активных учеников.');
    return;
  }

  const session = ensureSession(ctx);
  session.step = STEPS.ISSUE_STUDENT_SELECT;
  session.data = {};

  const text = (await studentService.formatStudentsDetailedList(students)) + '\n\nВыберите ученика:';
  await ctx.reply(text, studentSelectInline(students));
}

async function showLaptopIssueList(ctx, student) {
  const laptops = await laptopService.getFreeLaptops();
  if (!laptops.length) {
    clearState(ctx);
    await replyMain(ctx, '❌ Нет свободных ноутбуков.');
    return;
  }

  const session = ensureSession(ctx);
  session.step = STEPS.ISSUE_LAPTOP_SELECT;
  session.data = { studentId: student.id, studentName: student.name };

  const text =
    `Ученик: ${student.name}\n\n` +
    laptopService.formatFreeLaptopsInChat(laptops) +
    '\n\nВыберите ноутбук:';

  await ctx.reply(text, laptopService.laptopSelectInline(laptops, 'issue:laptop'));
}

async function showLaptopReturnList(ctx) {
  const transactions = await laptopService.getOccupiedLaptops();
  if (!transactions.length) {
    await ctx.reply('✅ Все ноутбуки на месте.');
    return;
  }

  const session = ensureSession(ctx);
  session.step = STEPS.LAPTOP_RETURN;

  const text = laptopService.formatOccupiedLaptops(transactions) + '\n\nНажмите ноут для возврата:';
  const { Markup } = require('telegraf');
  const rows = transactions.map((t) => [
    Markup.button.callback(`№${t.laptop.number} — ${t.student.name}`, `return:laptop:${t.laptop.id}`),
  ]);
  rows.push([Markup.button.callback(MENU.CANCEL, 'return:laptop:cancel')]);
  await ctx.reply(text, Markup.inlineKeyboard(rows));
}

async function showTeacherLaptopPicker(ctx, edit = false) {
  const laptops = await laptopService.getFreeLaptops();
  const selected = ctx.session.data.selectedLaptops || [];

  if (!laptops.length) {
    clearState(ctx);
    await replyMain(ctx, '❌ Нет свободных ноутбуков.');
    return;
  }

  const text =
    `Учитель: ${ctx.session.data.teacherName}\n\n` +
    laptopService.formatFreeLaptopsInChat(laptops) +
    '\n\nВыберите ноутбуки (нажмите для отметки):';

  const markup = laptopService.laptopMultiSelectInline(laptops, selected, 'ti');

  if (edit && ctx.callbackQuery) {
    await ctx.editMessageText(text, markup);
  } else {
    await ctx.reply(text, markup);
  }
}

async function showTeacherReturnPicker(ctx, teacher, edit = false) {
  const transactions = teacher.laptops.map((num) => ({ number: num }));
  const laptops = transactions.map((t, i) => ({ id: i, number: t.number }));
  const selected = ctx.session.data.selectedReturnLaptops || [];

  ctx.session.data.teacherReturnLaptops = teacher.laptops;

  const text =
    `Учитель: ${teacher.name}\n\n` +
    `Ноутбуки: №${teacher.laptops.join(', №')}\n\n` +
    'Выберите ноуты для возврата:';

  const { Markup } = require('telegraf');
  const rows = [];
  for (let i = 0; i < teacher.laptops.length; i += 3) {
    const chunk = teacher.laptops.slice(i, i + 3).map((num) => {
      const mark = selected.includes(num) ? '✅ ' : '';
      return Markup.button.callback(`${mark}№${num}`, `tr:toggle:${num}`);
    });
    rows.push(chunk);
  }
  rows.push([
    Markup.button.callback('✅ Готово', 'tr:confirm'),
    Markup.button.callback(MENU.CANCEL, 'tr:cancel'),
  ]);
  const markup = Markup.inlineKeyboard(rows);

  if (edit && ctx.callbackQuery) {
    await ctx.editMessageText(text, markup);
  } else {
    await ctx.reply(text, markup);
  }
}

function registerMenuHandlers(bot, adminOnly, canIssueReturn) {
  bot.hears(MENU.BACK, async (ctx) => {
    const session = ensureSession(ctx);
    if (session.menu === 'teacher_return') {
      session.menu = 'teachers';
      await replySubmenu(ctx, '👨‍🏫 Учителя:', teachersMenu());
      return;
    }
    clearState(ctx);
    await replyMain(ctx, 'Главное меню.');
  });

  bot.hears(MENU.CANCEL, async (ctx) => {
    clearState(ctx);
    await replyMain(ctx, 'Действие отменено.');
  });

  // ── Main sections ──
  bot.hears(MENU.LAPTOPS, canIssueReturn, async (ctx) => {
    const session = ensureSession(ctx);
    session.menu = 'laptops';
    const role = await getUserRole(ctx.from.id);
    await replySubmenu(ctx, '💻 Ноутбуки:', laptopsMenu(role === 'admin'));
  });

  bot.hears(MENU.TEACHERS, canIssueReturn, async (ctx) => {
    const role = await getUserRole(ctx.from.id);
    ensureSession(ctx).menu = 'teachers';
    await replySubmenu(ctx, '👨‍🏫 Учителя:', teachersMenu(role === 'admin'));
  });

  bot.hears(MENU.STUDENTS, canIssueReturn, async (ctx) => {
    const session = ensureSession(ctx);
    session.menu = 'students';
    const role = await getUserRole(ctx.from.id);
    await replySubmenu(ctx, '👨‍🎓 Ученики:', studentsMenu(role === 'admin'));
  });

  bot.hears(MENU.OCCUPIED, canIssueReturn, async (ctx) => {
    try {
      const transactions = await laptopService.getOccupiedLaptops();
      await ctx.reply(laptopService.formatOccupiedLaptops(transactions));
    } catch (err) {
      await ctx.reply(`❌ ${err.message}`);
    }
  });

  bot.hears(MENU.SUPPORTS, adminOnly, async (ctx) => {
    ensureSession(ctx).menu = 'supports';
    const supports = await supportService.listSupports();
    await ctx.reply(
      supportService.formatSupportList(supports) + '\n\nУправление супортами:',
      supportsMenu()
    );
  });

  // ── Laptops submenu ──
  bot.hears(MENU.ADD_LAPTOP, adminOnly, async (ctx) => {
    ensureSession(ctx).step = STEPS.LAPTOP_ADD;
    await ctx.reply('Введите номер или номера через пробел:', cancelMenu());
  });

  bot.hears(MENU.LAPTOP_OCCUPIED, canIssueReturn, async (ctx) => {
    try {
      const text = await laptopService.formatAllLaptopsInChat();
      await ctx.reply(text);
    } catch (err) {
      await ctx.reply(`❌ ${err.message}`);
    }
  });

  bot.hears(MENU.ISSUE_LAPTOP, canIssueReturn, async (ctx) => {
    try {
      await showStudentIssueList(ctx);
    } catch (err) {
      await ctx.reply(`❌ ${err.message}`);
    }
  });

  bot.hears(MENU.RETURN_LAPTOP, canIssueReturn, async (ctx) => {
    try {
      await showLaptopReturnList(ctx);
    } catch (err) {
      await ctx.reply(`❌ ${err.message}`);
    }
  });

  // ── Teachers submenu ──
  bot.hears(MENU.ADD_TEACHER, adminOnly, async (ctx) => {
    ensureSession(ctx).step = STEPS.TEACHER_ADD;
    await ctx.reply('Введите имя учителя:', cancelMenu());
  });

  bot.hears(MENU.TEACHER_ISSUE, canIssueReturn, async (ctx) => {
    ensureSession(ctx).step = STEPS.TEACHER_ISSUE_NAME;
    await ctx.reply('Введите имя учителя:', cancelMenu());
  });

  bot.hears(MENU.TEACHER_RETURN, canIssueReturn, async (ctx) => {
    ensureSession(ctx).menu = 'teacher_return';
    await replySubmenu(ctx, 'Выберите тип возврата:', teacherReturnMenu());
  });

  bot.hears(MENU.RETURN_ALL, canIssueReturn, async (ctx) => {
    const teachers = await getTeachersWithActiveLaptops();
    if (!teachers.length) {
      await ctx.reply('✅ Нет учителей с не возвращёнными ноутбуками.');
      return;
    }
    ensureSession(ctx).step = STEPS.TEACHER_RETURN_NAME;
    ensureSession(ctx).data = { returnMode: 'all' };
    const lines = teachers.map((t) => `• ${t.name} — ${t.count} шт. (№${t.laptops.join(', №')})`);
    await ctx.reply(
      'Вернуть все ноутбуки учителя:\n\n' + lines.join('\n'),
      teacherSelectInline(teachers, 'tr:all')
    );
  });

  bot.hears(MENU.RETURN_PICK, canIssueReturn, async (ctx) => {
    const teachers = await getTeachersWithActiveLaptops();
    if (!teachers.length) {
      await ctx.reply('✅ Нет учителей с не возвращёнными ноутбуками.');
      return;
    }
    ensureSession(ctx).step = STEPS.TEACHER_RETURN_PICK;
    const lines = teachers.map((t) => `• ${t.name} — ${t.count} шт. (№${t.laptops.join(', №')})`);
    await ctx.reply(
      'Выберите учителя:\n\n' + lines.join('\n'),
      teacherSelectInline(teachers, 'tr:pick')
    );
  });

  // ── Students submenu ──
  bot.hears(MENU.ADD_STUDENT, adminOnly, async (ctx) => {
    ensureSession(ctx).step = STEPS.STUDENT_ADD_NAME;
    await ctx.reply('Введите имя ученика:', cancelMenu());
  });

  bot.hears(MENU.STUDENT_LIST, canIssueReturn, async (ctx) => {
    try {
      const role = await getUserRole(ctx.from.id);

      if (role === 'admin') {
        const students = await studentService.listManagedStudents();
        if (!students.length) {
          await ctx.reply('👨‍🎓 Учеников нет.');
          return;
        }
        await ctx.reply(
          (await studentService.formatStudentsDetailedList(students)) + '\n\nВыберите ученика:',
          studentService.studentManageListInline(students)
        );
        return;
      }

      const students = await studentService.listAllowedStudents();
      await ctx.reply(await studentService.formatStudentsDetailedList(students, { forSupport: true }));
    } catch (err) {
      await ctx.reply(`❌ ${err.message}`);
    }
  });

  // ── Supports submenu ──
  bot.hears(MENU.ADD_SUPPORT, adminOnly, async (ctx) => {
    ensureSession(ctx).step = STEPS.SUPPORT_ADD;
    await ctx.reply('Telegram ID супорта (можно с именем): 123456789 Иван', cancelMenu());
  });

  bot.hears(MENU.REMOVE_SUPPORT, adminOnly, async (ctx) => {
    ensureSession(ctx).step = STEPS.SUPPORT_REMOVE;
    await ctx.reply('Telegram ID супорта для удаления:', cancelMenu());
  });

  // ── Inline: issue student → laptop ──
  bot.action(/^issue:student:(\d+|cancel)$/, canIssueReturn, async (ctx) => {
    await ctx.answerCbQuery();
    const value = ctx.match[1];
    if (value === 'cancel') {
      clearState(ctx);
      await replyMain(ctx, 'Отменено.');
      return;
    }
    const student = await studentService.getAllowedStudentById(Number(value));
    if (!student) {
      await ctx.reply('❌ Ученик неактивен.');
      return;
    }
    await showLaptopIssueList(ctx, student);
  });

  bot.action(/^issue:laptop:(\d+|cancel)$/, canIssueReturn, async (ctx) => {
    await ctx.answerCbQuery();
    const value = ctx.match[1];
    if (value === 'cancel') {
      clearState(ctx);
      await replyMain(ctx, 'Отменено.');
      return;
    }
    if (ctx.session?.step !== STEPS.ISSUE_LAPTOP_SELECT) return;

    try {
      const laptops = await laptopService.getFreeLaptops();
      const laptop = laptops.find((l) => l.id === Number(value));
      if (!laptop) throw new Error('Ноутбук уже занят');

      const result = await issueLaptop({
        studentId: ctx.session.data.studentId,
        laptopNumber: laptop.number,
        adminId: ctx.from.id,
        recipientType: 'student',
        requireAllowedStudent: true,
      });

      clearState(ctx);
      await replyMain(
        ctx,
        `✅ Выдано!\n${formatRecipient(result.transaction)}\nНоутбук: №${result.laptop.number}`
      );
    } catch (err) {
      await ctx.reply(`❌ ${err.message}`);
    }
  });

  // ── Inline: return laptop ──
  bot.action(/^return:laptop:(\d+|cancel)$/, canIssueReturn, async (ctx) => {
    await ctx.answerCbQuery();
    const value = ctx.match[1];
    if (value === 'cancel') {
      clearState(ctx);
      await replyMain(ctx, 'Отменено.');
      return;
    }

    try {
      const { Laptop } = require('../../models');
      const laptop = await Laptop.findByPk(Number(value));
      if (!laptop) throw new Error('Ноутбук не найден');

      const result = await returnLaptop({ laptopNumber: laptop.number, adminId: ctx.from.id });
      clearState(ctx);
      await replyMain(
        ctx,
        `✅ Возврат!\n${formatRecipient(result.transaction)}\nНоутбук: №${result.laptop.number}`
      );
    } catch (err) {
      await ctx.reply(`❌ ${err.message}`);
    }
  });

  // ── Inline: student manage (admin) ──
  bot.action(/^student:manage:(\d+|cancel)$/, adminOnly, async (ctx) => {
    await ctx.answerCbQuery();
    const value = ctx.match[1];
    if (value === 'cancel') return;

    const student = await studentService.getManagedStudentById(Number(value));
    if (!student) {
      await ctx.reply('❌ Ученик не найден.');
      return;
    }

    await ctx.reply(
      await studentService.formatStudentDetail(student),
      studentService.studentManageActionsInline(student.id)
    );
  });

  bot.action(/^student:extend:(\d+)$/, adminOnly, async (ctx) => {
    await ctx.answerCbQuery();
    const studentId = Number(ctx.match[1]);
    const student = await studentService.getManagedStudentById(studentId);
    if (!student) {
      await ctx.reply('❌ Ученик не найден.');
      return;
    }

    ensureSession(ctx).step = STEPS.STUDENT_EXTEND_DAYS;
    ensureSession(ctx).data = { studentId };
    await ctx.reply(
      `Ученик: ${student.name}\nСколько дней добавить? (30 = месяц, 1м = месяц)`,
      cancelMenu()
    );
  });

  bot.action(/^student:delete:(\d+)$/, adminOnly, async (ctx) => {
    await ctx.answerCbQuery();
    try {
      const student = await studentService.removeStudent(Number(ctx.match[1]));
      await ctx.reply(`✅ Ученик «${student.name}» удалён из списка.`);
    } catch (err) {
      await ctx.reply(`❌ ${err.message}`);
    }
  });

  // ── Inline: teacher issue multi-select ──
  bot.action(/^ti:(toggle:.+|confirm|cancel)$/, canIssueReturn, async (ctx) => {
    await ctx.answerCbQuery();
    const action = ctx.match[1];

    if (action === 'cancel') {
      clearState(ctx);
      await replyMain(ctx, 'Отменено.');
      return;
    }

    if (action === 'confirm') {
      try {
        const selected = ctx.session.data.selectedLaptops || [];
        const result = await issueTeacherLaptopsByNumbers({
          teacherName: ctx.session.data.teacherName,
          laptopNumbers: selected,
          adminId: ctx.from.id,
        });
        clearState(ctx);
        const lines = result.issued.map((r) => `• №${r.laptop.number}`).join('\n');
        let msg = `✅ Выдано учителю ${result.teacherName}:\n\n${lines}`;
        if (result.errors.length) {
          msg += '\n\n⚠️ ' + result.errors.join('\n');
        }
        await replyMain(ctx, msg);
      } catch (err) {
        await ctx.reply(`❌ ${err.message}`);
      }
      return;
    }

    const number = action.replace('toggle:', '');
    const selected = ctx.session.data.selectedLaptops || [];
    const idx = selected.indexOf(number);
    if (idx >= 0) selected.splice(idx, 1);
    else selected.push(number);
    ctx.session.data.selectedLaptops = selected;
    await showTeacherLaptopPicker(ctx, true);
  });

  // ── Inline: teacher return all ──
  bot.action(/^tr:all:(\d+|cancel)$/, canIssueReturn, async (ctx) => {
    await ctx.answerCbQuery();
    const value = ctx.match[1];
    if (value === 'cancel') {
      clearState(ctx);
      await replyMain(ctx, 'Отменено.');
      return;
    }

    try {
      const result = await returnTeacherLaptops({
        studentId: Number(value),
        adminId: ctx.from.id,
      });
      clearState(ctx);
      const lines = result.returned.map((t) => `• №${t.laptop.number}`).join('\n');
      await replyMain(ctx, `✅ Возврат от ${result.teacherName}:\n\n${lines}`);
    } catch (err) {
      await ctx.reply(`❌ ${err.message}`);
    }
  });

  // ── Inline: teacher return pick ──
  bot.action(/^tr:pick:(\d+|cancel)$/, canIssueReturn, async (ctx) => {
    await ctx.answerCbQuery();
    const value = ctx.match[1];
    if (value === 'cancel') {
      clearState(ctx);
      await replyMain(ctx, 'Отменено.');
      return;
    }

    const teachers = await getTeachersWithActiveLaptops();
    const teacher = teachers.find((t) => t.studentId === Number(value));
    if (!teacher) {
      await ctx.reply('❌ Учитель не найден.');
      return;
    }

    ctx.session.data.teacherId = teacher.studentId;
    ctx.session.data.teacherName = teacher.name;
    ctx.session.data.selectedReturnLaptops = [];
    ctx.session.step = STEPS.TEACHER_RETURN_PICK;
    await showTeacherReturnPicker(ctx, teacher);
  });

  bot.action(/^tr:(toggle:.+|confirm|cancel)$/, canIssueReturn, async (ctx) => {
    await ctx.answerCbQuery();
    const action = ctx.match[1];

    if (action === 'cancel') {
      clearState(ctx);
      await replyMain(ctx, 'Отменено.');
      return;
    }

    if (action === 'confirm') {
      try {
        const selected = ctx.session.data.selectedReturnLaptops || [];
        const result = await returnTeacherLaptopsPartial({
          studentId: ctx.session.data.teacherId,
          laptopNumbers: selected,
          adminId: ctx.from.id,
        });
        clearState(ctx);
        const lines = result.returned.map((t) => `• №${t.laptop.number}`).join('\n');
        await replyMain(ctx, `✅ Возврат от ${result.teacherName}:\n\n${lines}`);
      } catch (err) {
        await ctx.reply(`❌ ${err.message}`);
      }
      return;
    }

    const number = action.replace('toggle:', '');
    const selected = ctx.session.data.selectedReturnLaptops || [];
    const idx = selected.indexOf(number);
    if (idx >= 0) selected.splice(idx, 1);
    else selected.push(number);
    ctx.session.data.selectedReturnLaptops = selected;

    const teachers = await getTeachersWithActiveLaptops();
    const teacher = teachers.find((t) => t.studentId === ctx.session.data.teacherId);
    if (teacher) await showTeacherReturnPicker(ctx, teacher, true);
  });

  // ── Text steps ──
  bot.on('text', async (ctx, next) => {
    const text = ctx.message.text?.trim();
    if (!text || text.startsWith('/') || text === MENU.CANCEL) return next();

    const step = ctx.session?.step;
    if (!step) return next();

    const userId = ctx.from.id;
    const adminSteps = [
      STEPS.LAPTOP_ADD,
      STEPS.STUDENT_ADD_NAME,
      STEPS.STUDENT_ADD_DURATION,
      STEPS.STUDENT_EXTEND_DAYS,
      STEPS.SUPPORT_ADD,
      STEPS.SUPPORT_REMOVE,
      STEPS.TEACHER_ADD,
    ];

    if (adminSteps.includes(step) && !isAdmin(userId)) {
      return ctx.reply('⛔ Нет доступа.');
    }

    try {
      if (step === STEPS.LAPTOP_ADD) {
        const result = await laptopService.addLaptops(text);
        clearState(ctx);
        const lines = result.added.map((l) => `• №${l.number}`).join('\n');
        await replyMain(ctx, `✅ Добавлено:\n${lines}`);
        return;
      }

      if (step === STEPS.TEACHER_ADD) {
        const name = text.trim();
        await Student.findOrCreate({ where: { name }, defaults: { name, isAllowed: false } });
        clearState(ctx);
        await replyMain(ctx, `✅ Учитель «${name}» добавлен.`);
        return;
      }

      if (step === STEPS.TEACHER_ISSUE_NAME) {
        ctx.session.data.teacherName = text;
        ctx.session.data.selectedLaptops = [];
        ctx.session.step = STEPS.TEACHER_ISSUE_LAPTOPS;
        await showTeacherLaptopPicker(ctx);
        return;
      }

      if (step === STEPS.STUDENT_ADD_NAME) {
        ctx.session.data.studentName = text;
        ctx.session.step = STEPS.STUDENT_ADD_DURATION;
        await ctx.reply('На сколько дней? (30 = месяц, 1м = месяц, 60 = 2 месяца)');
        return;
      }

      if (step === STEPS.STUDENT_ADD_DURATION) {
        const { student, days } = await studentService.addAllowedStudent(
          ctx.session.data.studentName,
          text
        );
        clearState(ctx);
        await replyMain(
          ctx,
          `✅ «${student.name}» добавлен на ${days} дн. до ${student.activeUntil.toLocaleDateString('ru-RU')}`
        );
        return;
      }

      if (step === STEPS.STUDENT_EXTEND_DAYS) {
        const { student, days } = await studentService.extendStudentDays(
          ctx.session.data.studentId,
          text
        );
        clearState(ctx);
        await replyMain(
          ctx,
          `✅ «${student.name}» продлён на ${days} дн.\nАктивен до ${student.activeUntil.toLocaleDateString('ru-RU')}`
        );
        return;
      }

      if (step === STEPS.SUPPORT_ADD) {
        const parts = text.split(/\s+/);
        await supportService.addSupport({
          telegramId: parts[0],
          name: parts.slice(1).join(' ') || null,
          createdBy: userId,
        });
        clearState(ctx);
        await replyMain(ctx, `✅ Супорт ${parts[0]} добавлен.`);
        return;
      }

      if (step === STEPS.SUPPORT_REMOVE) {
        await supportService.removeSupport(text);
        clearState(ctx);
        await replyMain(ctx, `✅ Супорт удалён.`);
        return;
      }
    } catch (err) {
      await ctx.reply(`❌ ${err.message}`);
    }
  });
}

module.exports = { registerMenuHandlers };
