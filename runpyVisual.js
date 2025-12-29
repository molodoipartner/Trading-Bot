const { PythonShell } = require('python-shell');

function runpyVisual() {
  console.log("ANALYS")
  return new Promise((resolve, reject) => {
    PythonShell.run('visualize_stats.py', null, function (err, results) {
      if (err) {
        console.error("❌ Ошибка при запуске Python:", err);
        reject(err);
        return;
      }
 
      console.log("✅ Визуализация завершена.");
      console.log(results ? results.join('\n') : 'Нет вывода.');
      resolve(results);
    });
  });
}

module.exports = runpyVisual;
