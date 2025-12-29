async function runStrategyonlyLong(candles, config) {
  console.log("runStrategyonlyLong — без SMA, вход раз в 30 мин");

  const { timeStart = 0, timeEnd = 25 } = config;
  const VOLUME = config.VOLUME;
  const SPREAD = config.SPREAD;
  const TP_PIPS = config.TP_PIPS;
  const SL_PIPS = config.SL_PIPS;

  const pipValue = 0.0001;
  const trades = [];
  let isInPosition = false;

  const MINUTES_BETWEEN_ENTRIES = 30;
  let lastEntryTime = null;

  function parseTime(str) {
    // str = '2024-07-16 09:30:00'
    const [date, time] = str.split(" ");
    const [h, m, s] = time.split(":").map(Number);
    const [year, month, day] = date.split("-").map(Number);
    return new Date(year, month - 1, day, h, m, s);
  }

  for (let i = 0; i < candles.length; i++) {
    const curr = candles[i];
    const hour = parseInt(curr.time.split(" ")[1].split(":")[0], 10);

    // Пропускаем, если не в пределах временного окна
    if (timeEnd > timeStart) {
      if (hour < timeStart || hour >= timeEnd) continue;
    } else {
      if (hour < timeStart && hour >= timeEnd) continue;
    }

    if (isInPosition) continue;

    const currTime = parseTime(curr.time);
    if (lastEntryTime) {
      const minutesSinceLastEntry = (currTime - lastEntryTime) / 1000 / 60;
      if (minutesSinceLastEntry < MINUTES_BETWEEN_ENTRIES) continue;
    }

    // Вход в LONG
    isInPosition = true;
    lastEntryTime = currTime;

    const entryTime = curr.time;
    const entryPrice = curr.close;

    const takeProfit = entryPrice + TP_PIPS * pipValue;
    const stopLoss = entryPrice - SL_PIPS * pipValue;

    let exitTime = entryTime;
    let exitPrice = entryPrice;
    let result = "NONE";
    let positionClosed = false;

    for (let j = i + 1; j < candles.length; j++) {
      const candle = candles[j];
      const exitHour = parseInt(candle.time.split(" ")[1].split(":")[0], 10);

      if (candle.high >= takeProfit) {
        exitPrice = takeProfit;
        exitTime = candle.time;
        result = "TAKE";
        positionClosed = true;
        break;
      }

      if (candle.low <= stopLoss) {
        exitPrice = stopLoss;
        exitTime = candle.time;
        result = "STOP";
        positionClosed = true;
        break;
      }

      const nextHour = parseInt(candles[j + 1]?.time?.split(" ")[1].split(":")[0] || 0, 10);
      const sessionEnding = timeEnd > timeStart
        ? (nextHour >= timeEnd)
        : (nextHour < timeStart && nextHour >= timeEnd);

      if (sessionEnding) {
        exitPrice = candle.close;
        exitTime = candle.time;
        result = exitPrice > entryPrice ? "TAKE" : "STOP";
        positionClosed = true;
        break;
      }
    }

    if (!positionClosed) {
      console.warn(`⚠️ Позиция не была закрыта: ${entryTime}`);
      isInPosition = false;
      continue;
    }

    isInPosition = false;

    const entryPriceRounded = parseFloat(entryPrice.toFixed(5));
    const exitPriceRounded = parseFloat(exitPrice.toFixed(5));

    const entryWithSpread = entryPriceRounded + SPREAD / 2;
    const exitWithSpread = exitPriceRounded - SPREAD / 2;

    const QuotedSpent = entryWithSpread * VOLUME;
    const QuotedReceived = exitWithSpread * VOLUME;
    const profitQuoted = QuotedReceived - QuotedSpent;

    trades.push({
      entryTime,
      entryPrice: entryPriceRounded,
      entryPriceWithSpread: parseFloat(entryWithSpread.toFixed(5)),
      stopLoss,
      takeProfit,
      exitTime,
      exitPrice: exitPriceRounded,
      exitPriceWithSpread: parseFloat(exitWithSpread.toFixed(5)),
      direction: "LONG",
      result,
      volume: VOLUME,
      QuotedSpent: parseFloat(QuotedSpent.toFixed(2)),
      QuotedReceived: parseFloat(QuotedReceived.toFixed(2)),
      profitQuoted: parseFloat(profitQuoted.toFixed(2)),
      spreadUsed: SPREAD,
    });
  }

  return trades;
}

module.exports = { runStrategyonlyLong };
