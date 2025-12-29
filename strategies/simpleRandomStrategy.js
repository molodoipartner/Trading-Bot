// Простая стратегия: вход в 11:00, случайное направление
module.exports = function runStrategy(candles, config) {
  const trades = [];
  const seenDates = new Set();

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    const [date, time] = candle.time.split(" ");
    const hour = time.split(":")[0];

    if (hour === "11" && !seenDates.has(date)) {
      seenDates.add(date);

      const entryTime = candle.time;
      const entryPrice = candle.open;
      const direction = Math.random() > 0.5 ? "LONG" : "SHORT";

      const takeProfit =
        direction === "LONG"
          ? entryPrice + config.tpPips
          : entryPrice - config.tpPips;

      const stopLoss =
        direction === "LONG"
          ? entryPrice - config.tpPips / config.riskReward
          : entryPrice + config.tpPips / config.riskReward;

      let exitTime = candle.time;
      let exitPrice = entryPrice;
      let result = "NONE";

      for (let j = i + 1; j < candles.length; j++) {
        const c = candles[j];
        if (direction === "LONG") {
          if (c.high >= takeProfit) {
            exitTime = c.time;
            exitPrice = takeProfit;
            result = "TAKE";
            break;
          } else if (c.low <= stopLoss) {
            exitTime = c.time;
            exitPrice = stopLoss;
            result = "STOP";
            break;
          }
        } else {
          if (c.low <= takeProfit) {
            exitTime = c.time;
            exitPrice = takeProfit;
            result = "TAKE";
            break;
          } else if (c.high >= stopLoss) {
            exitTime = c.time;
            exitPrice = stopLoss;
            result = "STOP";
            break;
          }
        }
      }

      trades.push({
        entryTime,
        entryPrice: parseFloat(entryPrice.toFixed(5)),
        stopLoss: parseFloat(stopLoss.toFixed(5)),
        takeProfit: parseFloat(takeProfit.toFixed(5)),
        exitTime,
        exitPrice: parseFloat(exitPrice.toFixed(5)),
        direction,
        result,
        volume: config.volume,
      });
    }
  }

  return trades;
};
