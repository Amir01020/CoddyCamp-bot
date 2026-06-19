const {
  issueLaptop,
  issueTeacherLaptops,
  returnLaptop,
  returnTeacherLaptops,
  getTeachersWithActiveLaptops,
  findTeacherByButton,
  formatRecipient,
} = require('../../services/issueService');
const supportService = require('../../services/supportService');
const { getUserRole, isAdmin, isSupport } = require('../middlewares/isAdmin');
const { menuForRole, cancelMenu, supportManageMenu, teacherReturnMenu } = require('../keyboards');

const STEPS = {
  ISSUE_NAME: 'issue_name',
  ISSUE_LAPTOP: 'issue_laptop',
  TEACHER_NAME: 'teacher_name',
  TEACHER_LAPTOPS: 'teacher_laptops',
  TEACHER_RETURN: 'teacher_return',
  RETURN_LAPTOP: 'return_laptop',
  LAPTOP_QUERY: 'laptop_query',
  SUPPORT_ADD: 'support_add',
  SUPPORT_REMOVE: 'support_remove',
};

function clearState(ctx) {
  ctx.session = ctx.session || {};
  ctx.session.step = null;
  ctx.session.data = {};
}

async function replyWithMenu(ctx, text) {
  const role = await getUserRole(ctx.from.id);
  await ctx.reply(text, menuForRole(role));
}

async function showTeacherReturnList(ctx) {
  const teachers = await getTeachersWithActiveLaptops();

  if (!teachers.length) {
    clearState(ctx);
    await replyWithMenu(ctx, '✅ Нет учителей с не возвращёнными ноутбуками.');
    return;
  }

  ctx.session = ctx.session || {};
  ctx.session.step = STEPS.TEACHER_RETURN;
  ctx.session.data = { teacherReturnOptions: teachers };

  const lines = teachers.map(
    (teacher) => `• ${teacher.name} — ${teacher.count} шт. (№${teacher.laptops.join(', №')})`
  );

  await ctx.reply(
    'Выберите учителя для возврата всех ноутбуков:\n\n' + lines.join('\n'),
    teacherReturnMenu(teachers)
  );
}

function registerAdminHandlers(bot, adminOnly, canIssueReturn) {
  bot.hears('📤 Выдать ноутбук', canIssueReturn, async (ctx) => {
    ctx.session = ctx.session || {};
    ctx.session.step = STEPS.ISSUE_NAME;
    ctx.session.data = {};
    await ctx.reply('Введите имя ученика:', cancelMenu());
  });

  bot.hears('📤 Выдать учителю', adminOnly, async (ctx) => {
    ctx.session = ctx.session || {};
    ctx.session.step = STEPS.TEACHER_NAME;
    ctx.session.data = {};
    await ctx.reply('Введите имя учителя:', cancelMenu());
  });

  bot.hears('📥 Вернуть от учителя', adminOnly, async (ctx) => {
    try {
      await showTeacherReturnList(ctx);
    } catch (err) {
      await ctx.reply(`❌ ${err.message}`);
    }
  });

  bot.hears('📥 Вернуть ноутбук', canIssueReturn, async (ctx) => {
    ctx.session = ctx.session || {};
    ctx.session.step = STEPS.RETURN_LAPTOP;
    ctx.session.data = {};
    await ctx.reply('Введите номер ноутбука для возврата:', cancelMenu());
  });

  bot.hears('👥 Супорты', adminOnly, async (ctx) => {
    try {
      const supports = await supportService.listSupports();
      await ctx.reply(
        supportService.formatSupportList(supports) +
          '\n\nДля добавления нажмите «➕ Добавить супорта».\nДля удаления — «➖ Удалить супорта».',
        supportManageMenu()
      );
    } catch (err) {
      await ctx.reply(`❌ ${err.message}`);
    }
  });

  bot.hears('➕ Добавить супорта', adminOnly, async (ctx) => {
    ctx.session = ctx.session || {};
    ctx.session.step = STEPS.SUPPORT_ADD;
    ctx.session.data = {};
    await ctx.reply(
      'Отправьте Telegram ID супорта (команда /myid у пользователя).\n' +
        'Можно указать имя через пробел: 123456789 Иван',
      cancelMenu()
    );
  });

  bot.hears('➖ Удалить супорта', adminOnly, async (ctx) => {
    ctx.session = ctx.session || {};
    ctx.session.step = STEPS.SUPPORT_REMOVE;
    ctx.session.data = {};
    await ctx.reply('Отправьте Telegram ID супорта для удаления:', cancelMenu());
  });

  bot.hears('◀️ Назад', adminOnly, async (ctx) => {
    clearState(ctx);
    await replyWithMenu(ctx, 'Главное меню.');
  });

  bot.hears('❌ Отмена', async (ctx) => {
    clearState(ctx);
    await replyWithMenu(ctx, 'Действие отменено.');
  });

  bot.on('text', async (ctx, next) => {
    const text = ctx.message.text?.trim();
    if (!text || text.startsWith('/')) return next();

    const step = ctx.session?.step;
    if (!step) return next();

    if (text === '❌ Отмена') return next();

    const userId = ctx.from.id;
    const issueSteps = [STEPS.ISSUE_NAME, STEPS.ISSUE_LAPTOP, STEPS.RETURN_LAPTOP];
    const teacherSteps = [STEPS.TEACHER_NAME, STEPS.TEACHER_LAPTOPS, STEPS.TEACHER_RETURN];
    const supportSteps = [STEPS.SUPPORT_ADD, STEPS.SUPPORT_REMOVE];

    if (issueSteps.includes(step)) {
      const allowed = isAdmin(userId) || (await isSupport(userId));
      if (!allowed) {
        return ctx.reply('⛔ Нет доступа. Обратитесь к администратору.');
      }
    }

    if (teacherSteps.includes(step) || supportSteps.includes(step)) {
      if (!isAdmin(userId)) {
        return ctx.reply('⛔ Нет доступа. Обратитесь к администратору.');
      }
    }

    try {
      if (step === STEPS.ISSUE_NAME) {
        ctx.session.data.studentName = text;
        ctx.session.step = STEPS.ISSUE_LAPTOP;
        await ctx.reply(`Ученик: ${text}\nТеперь введите номер ноутбука:`);
        return;
      }

      if (step === STEPS.ISSUE_LAPTOP) {
        const result = await issueLaptop({
          studentName: ctx.session.data.studentName,
          laptopNumber: text,
          adminId: userId,
          recipientType: 'student',
        });

        clearState(ctx);
        await replyWithMenu(
          ctx,
          `✅ Выдано!\n\n` +
            `${formatRecipient(result.transaction)}\n` +
            `Ноутбук: №${result.laptop.number}\n` +
            `Время: ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
        );
        return;
      }

      if (step === STEPS.TEACHER_NAME) {
        ctx.session.data.teacherName = text;
        ctx.session.step = STEPS.TEACHER_LAPTOPS;
        await ctx.reply(
          `Учитель: ${text}\n` +
            'Введите номера ноутбуков через пробел или запятую:\n' +
            'Например: 1 2 3 или 1, 2, 3'
        );
        return;
      }

      if (step === STEPS.TEACHER_LAPTOPS) {
        const result = await issueTeacherLaptops({
          teacherName: ctx.session.data.teacherName,
          laptopNumbersInput: text,
          adminId: userId,
        });

        clearState(ctx);

        const issuedLines = result.issued.map(
          (r) => `• №${r.laptop.number}`
        );
        let message =
          `✅ Выдано учителю ${result.teacherName}:\n\n` + issuedLines.join('\n');

        if (result.errors.length) {
          message += '\n\n⚠️ Не удалось выдать:\n' + result.errors.map((e) => `• ${e}`).join('\n');
        }

        await replyWithMenu(ctx, message);
        return;
      }

      if (step === STEPS.TEACHER_RETURN) {
        const options = ctx.session.data.teacherReturnOptions || [];
        const teacher = findTeacherByButton(options, text);

        if (!teacher) {
          await ctx.reply('Выберите учителя из списка кнопок ниже.');
          return;
        }

        const result = await returnTeacherLaptops({
          studentId: teacher.studentId,
          adminId: userId,
        });

        clearState(ctx);

        const returnedLines = result.returned.map((t) => `• №${t.laptop.number}`);
        const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

        await replyWithMenu(
          ctx,
          `✅ Возврат от учителя ${result.teacherName}:\n\n` +
            returnedLines.join('\n') +
            `\n\nВсего: ${result.returned.length} шт.\n` +
            `Время: ${time}`
        );
        return;
      }

      if (step === STEPS.RETURN_LAPTOP) {
        const result = await returnLaptop({
          laptopNumber: text,
          adminId: userId,
        });

        clearState(ctx);
        await replyWithMenu(
          ctx,
          `✅ Возврат принят!\n\n` +
            `${formatRecipient(result.transaction)}\n` +
            `Ноутбук: №${result.laptop.number}\n` +
            `Время: ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
        );
        return;
      }

      if (step === STEPS.SUPPORT_ADD) {
        const parts = text.split(/\s+/);
        const telegramId = parts[0];
        const name = parts.slice(1).join(' ') || null;

        await supportService.addSupport({
          telegramId,
          name,
          createdBy: userId,
        });

        clearState(ctx);
        await replyWithMenu(ctx, `✅ Супорт ${telegramId}${name ? ` (${name})` : ''} добавлен.`);
        return;
      }

      if (step === STEPS.SUPPORT_REMOVE) {
        await supportService.removeSupport(text);
        clearState(ctx);
        await replyWithMenu(ctx, `✅ Супорт ${text} удалён.`);
        return;
      }
    } catch (err) {
      await ctx.reply(`❌ ${err.message}`);
    }
  });
}

module.exports = {
  STEPS,
  clearState,
  registerAdminHandlers,
};
