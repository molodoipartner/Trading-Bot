function runAt(timeString, fn) {
  const target = new Date(timeString).getTime();
  console.log("Target time (ms):", target);
  const now = Date.now();

  const delay = target - now;

  if (delay <= 0) {
    throw new Error("Target time must be in the future");
  }

  console.log("⏰ Запланирован запуск:", new Date(target).toISOString());

  setTimeout(fn, delay);
}

module.exports = {
  runAt,
};
