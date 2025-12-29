const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const calculateSMA = require("./utils/calculateSMA");

/**
 * Генерирует SMA файл из входного CSV
 * @param {number} smaPeriod - Период SMA
 * @param {string} inputPath - Путь к входному CSV-файлу
 * @param {string} outputDir - Папка для сохранения выходного CSV-файла
 */
function generateSMA(smaPeriod, inputPath = "backtest/ETHUSDT_5m.csv", outputDir = "backtest/indicator") {
  const candles = [];

  fs.createReadStream(inputPath)
    .pipe(csv())
    .on("data", (row) => {
      candles.push({
        time: row.time,
        close: parseFloat(row.close),
      });
    })
    .on("end", () => {
      const sma = calculateSMA(candles, smaPeriod);

      const smaData = candles.map((candle, index) => ({
        time: candle.time,
        sma: sma[index],
      }));

      const outputPath = path.join(outputDir, `sma${smaPeriod}.csv`);
      const csvWriter = createCsvWriter({
        path: outputPath,
        header: [
          { id: "time", title: "time" },
          { id: "sma", title: `sma${smaPeriod}` },
        ],
      });

      csvWriter.writeRecords(smaData).then(() => {
        console.log(`✅ SMA${smaPeriod} сохранена в ${outputPath}`);
      });
    });
}

module.exports = generateSMA;
