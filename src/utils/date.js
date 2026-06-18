function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function formatTime(date) {
  return new Date(date).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('ru-RU');
}

module.exports = {
  getTodayRange,
  formatTime,
  formatDate,
};
