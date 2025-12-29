// generateTrades.js
const fs = require("fs");
const csv = require("csv-parser");
const { runStrategySMA } = require("./strategies/generateTradesBySMA.js");
const { runStrategySMAS } = require("./strategies/generateTradesBySMAS.js");
const { runStrategy2SMA } = require("./strategies/generateTradesBy2SMA.js");
const { runStrategy3SMA } = require("./strategies/generateTradesBy3SMA.js");
const { runStrategy2SMAStopTake } = require("./strategies/2SMA_Stop_and_Take.js");
const { runStrategyonlyLong } = require("./strategies/onlyLong.js")
const runStrategy = require("./strategies/simpleRandomStrategy");
const saveResults = require("./utils/saveResults");
const { runStrategyEveryHour } = require("./strategies/Every_hour_position.js");
const { runMorningQuintupleLongStrategy } = require("./strategies/instarding.js");

function generateTrades(startTimegenerate, endTimegenerate, config) {
const candles = [];


fs.createReadStream("backtest/ETHUSDT_5m.csv")
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