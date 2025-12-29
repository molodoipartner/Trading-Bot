const fs = require("fs");

function saveResults(trades, config, candles) {
  const stats = {
    totalTrades: trades.length,
    profitableTrades: 0,
    losingTrades: 0,
    noneTrades: 0,
    longTrades: 0,
    shortTrades: 0,
    totalProfitQuoted: 0,
    averageProfitQuoted: 0,
    maxProfitQuoted: null,
    maxLossQuoted: null,
    startBalance: config.START_BALANCE,
    finalBalance: config.START_BALANCE,
    totalDaysInData: 0,
    winRate: 0,
    averageTradesPerDay: 0, // ← добавлено новое поле
  };

  const candleDates = new Set();
  for (const candle of candles) {
    const dateOnly = candle.time.split(" ")[0];
    candleDates.add(dateOnly);
  }
  stats.totalDaysInData = candleDates.size;

  for (const trade of trades) {
    const profit = trade.profitQuoted;
    stats.finalBalance += profit;
    stats.totalProfitQuoted += profit;

    if (trade.result === "TAKE") stats.profitableTrades++;
    else if (trade.result === "STOP") stats.losingTrades++;
    else stats.noneTrades++;

    if (trade.direction === "LONG") stats.longTrades++;
    else if (trade.direction === "SHORT") stats.shortTrades++;

    if (stats.maxProfitQuoted === null || profit > stats.maxProfitQuoted) {
      stats.maxProfitQuoted = profit;
    }

    if (stats.maxLossQuoted === null || profit < stats.maxLossQuoted) {
      stats.maxLossQuoted = profit;
    }
  }

  const completedTrades = stats.profitableTrades + stats.losingTrades;
  stats.winRate = completedTrades > 0
    ? parseFloat((stats.profitableTrades / completedTrades * 100).toFixed(2))
    : 0;

  stats.finalBalance = parseFloat(stats.finalBalance.toFixed(2));
  stats.totalProfitQuoted = parseFloat(stats.totalProfitQuoted.toFixed(2));
  stats.averageProfitQuoted =
    trades.length > 0
      ? parseFloat((stats.totalProfitQuoted / trades.length).toFixed(2))
      : 0;

  stats.averageTradesPerDay = stats.totalDaysInData > 0
    ? parseFloat((stats.totalTrades / stats.totalDaysInData).toFixed(2))
    : 0;

  fs.writeFileSync("positions/trades.json", JSON.stringify(trades, null, 2));
  fs.writeFileSync("positions/trade_stats.json", JSON.stringify(stats, null, 2));

  console.log("✅ Результаты сохранены в positions/");
}

module.exports = saveResults;
