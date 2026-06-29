function isNetworkError(err) {
  const code = err?.code || '';
  const msg = err?.message || '';
  return (
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNREFUSED' ||
    code === 'EAI_AGAIN' ||
    msg.includes('ECONNRESET') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('socket hang up')
  );
}

function formatUserError(err) {
  if (isNetworkError(err)) {
    return 'Ошибка сети при связи с Telegram. Попробуйте ещё раз. Если повторяется — настройте TELEGRAM_PROXY в .env';
  }
  return err?.message || 'Неизвестная ошибка';
}

async function withRetry(fn, retries = 2, delayMs = 1000) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isNetworkError(err) || attempt === retries) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }
  throw lastError;
}

async function safeReply(ctx, text, extra) {
  return withRetry(() => ctx.reply(text, extra));
}

module.exports = {
  isNetworkError,
  formatUserError,
  withRetry,
  safeReply,
};
