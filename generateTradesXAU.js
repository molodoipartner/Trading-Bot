// generateTrades.js
const fs = require("fs");
const csv = require("csv-parser");

const saveResults = require("./utils/saveResults");
const { runMorningQuintupleLongStrategy } = require("./strategies/instardingXAU.js");

function generateTrades(startTimegenerate, endTimegenerate, config, datapath) {
const candles = [];


fs.createReadStream(datapath)
  .pipe(csv())
  .on("data", (row) => {
    const candleTime = new Date(row.time);

    if (candleTime >= startTimegenerate && candleTime <= endTimegenerate) {
      candles.push({
        time: row.time,
        open: parseFloat(row.open),
        high: parseFloat(row.high),
        low: parseFloat(row.low),
        close: parseFloat(row.close),
      });
    }
  })
  .on("end", async () => {
    const trades = await runMorningQuintupleLongStrategy(candles, config);
    saveResults(trades, config, candles);
  });
}

module.exports = generateTrades;