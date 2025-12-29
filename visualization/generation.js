const path = require("path");
const generateHtml = require("../visualization/generateHtml");
const fs = require("fs");
/**
 * Запускает генерацию визуализации с указанными SMA и временем
 * @param {string} startTime - Начальное время (например, "2024-01-01T00:00")
 * @param {string} endTime - Конечное время
 * @param {string} datapath - Путь к CSV с рыночными данными
 * @param {number} sma1Period - Период первой SMA
 * @param {number} sma2Period - Период второй SMA
 * @param {number} sma3Period - Период второй SMA
 */
function runGeneration(startTime, endTime, datapath, sma1Period, sma2Period, sma3Period) {
  console.log("Start Time:", startTime);
  console.log("End Time:", endTime);

  const sessionRanges = [
    { name: "frankfurt", start: "10:00", end: "11:00", color: "rgba(0, 128, 0, 0.2)" },
    { name: "london", start: "11:00", end: "19:00", color: "rgba(0, 0, 255, 0.2)" },
    { name: "newYork", start: "16:00", end: "00:00", color: "rgba(207, 182, 0, 0.2)" },
  ];

    function safePath(p) {
        return fs.existsSync(p) ? p : null;   // или 0, или "" — что тебе нужно
    }

    const sma1Path = safePath(path.join("./backtest/indicator", `sma${sma1Period}.csv`));
    const sma2Path = safePath(path.join("./backtest/indicator", `sma${sma2Period}.csv`));
    const sma3Path = safePath(path.join("./backtest/indicator", `sma${sma3Period}.csv`));


  generateHtml(datapath, sessionRanges, "./positions/trades.json", startTime, endTime, sma1Path, sma2Path, sma3Path);
}

module.exports = runGeneration;
