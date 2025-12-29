const fs = require("fs");
const csv = require("csv-parser");

function loadSMA(smaPath) {
  return new Promise((resolve, reject) => {
    const smaMap = new Map();
    fs.createReadStream(smaPath)
      .pipe(csv(["time", "sma5"]))
      .on("data", (row) => {
        const time = row.time.trim();
        const smaValue = parseFloat(row.sma5);
        if (!isNaN(smaValue)) {
          smaMap.set(time, smaValue);
        }
      })
      .on("end", () => resolve(smaMap))
      .on("error", (err) => reject(err));
  });
}

async function runStrategySMAS(candles, config) {
  console.log("runStrategySMAS");

  const { timeStart = 0, timeEnd = 24 } = config;

  const VOLUME = config.VOLUME;
  const SPREAD = config.SPREAD
  console.log(config.smaPath)
  const smaMap = await loadSMA(config.smaPath);
  const trades = [];
  let lastTradeTime = null;

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];

    const hour = parseInt(curr.time.split(" ")[1].split(":")[0], 10);

    // Проверка временного окна
    if (timeEnd > timeStart) {
      if (hour < timeStart || hour >= timeEnd) continue;
    } else {
      if (hour < timeStart && hour >= timeEnd) continue;
    }

    // Проверка на минимальный интервал между сделками (опционально)
    if (lastTradeTime) {
      const diffMinutes = (new Date(curr.time) - new Date(lastTradeTime)) / (1000 * 60);
      // if (diffMinutes < 60) continue;
    }

    const prevSMA = smaMap.get(prev.time) ?? null;
    const currSMA = smaMap.get(curr.time) ?? null;
    if (!prevSMA || !currSMA) continue;

    const crossedUp = (prev.close <= prevSMA && curr.close > currSMA)
                   || (prev.close < prevSMA && curr.close >= currSMA);
    const crossedDown = (prev.close >= prevSMA && curr.close < currSMA)
                     || (prev.close > prevSMA && curr.close <= currSMA);

    let direction = null;

    if (crossedUp) {
      direction = "LONG";
      console.log("Пересечение вверх на индексе:", i);
    } else if (crossedDown) {
      direction = "SHORT";
    } else {
      continue;
    }

    const entryTime = curr.time;
    const entryPrice = curr.close;
    let exitTime = entryTime;
    let exitPrice = entryPrice;
    let takeProfit = null;
    let stopLoss = null;
    let result = "NONE";

    // Поиск выхода по противоположному пересечению
    for (let j = i + 1; j < candles.length; j++) {
      const prevCandle = candles[j - 1];
      const currCandle = candles[j];

      const prevSMA_exit = smaMap.get(prevCandle.time) ?? null;
      const currSMA_exit = smaMap.get(currCandle.time) ?? null;
      if (!prevSMA_exit || !currSMA_exit) continue;

      const crossExitLong = direction === "LONG" &&
        ((prevCandle.close >= prevSMA_exit && currCandle.close < currSMA_exit) ||
         (prevCandle.close > prevSMA_exit && currCandle.close <= currSMA_exit));

      const crossExitShort = direction === "SHORT" &&
        ((prevCandle.close <= prevSMA_exit && currCandle.close > currSMA_exit) ||
         (prevCandle.close < prevSMA_exit && currCandle.close >= currSMA_exit));

      if (crossExitLong || crossExitShort) {
        exitTime = currCandle.time;
        exitPrice = currCandle.close;

        if (direction === "LONG") {
          if (exitPrice > entryPrice) {
            result = "TAKE";
            takeProfit = parseFloat((exitPrice - SPREAD / 2).toFixed(5));
          } else {
            result = "STOP";
            stopLoss = parseFloat((exitPrice - SPREAD / 2).toFixed(5));
          }
        } else {
          if (exitPrice < entryPrice) {
            result = "TAKE";
            takeProfit = parseFloat((exitPrice + SPREAD / 2).toFixed(5));
          } else {
            result = "STOP";
            stopLoss = parseFloat((exitPrice + SPREAD / 2).toFixed(5));
          }
        }
        break;
      }
    }

    const entryPriceRounded = parseFloat(entryPrice.toFixed(5));
    const exitPriceRounded = parseFloat(exitPrice.toFixed(5));

    const entryPriceWithSpread = direction === "LONG"
      ? entryPriceRounded + SPREAD / 2
      : entryPriceRounded - SPREAD / 2;

    const exitPriceWithSpread = direction === "LONG"
      ? exitPriceRounded - SPREAD / 2
      : exitPriceRounded + SPREAD / 2;

    const QuotedSpent = direction === "LONG"
      ? entryPriceWithSpread * VOLUME
      : exitPriceWithSpread * VOLUME;

    const QuotedReceived = direction === "LONG"
      ? exitPriceWithSpread * VOLUME
      : entryPriceWithSpread * VOLUME;

    const profitQuoted = QuotedReceived - QuotedSpent;

    trades.push({
      entryTime,
      entryPrice: entryPriceRounded,
      entryPriceWithSpread: parseFloat(entryPriceWithSpread.toFixed(5)),
      stopLoss,
      takeProfit,
      exitTime,
      exitPrice: exitPriceRounded,
      exitPriceWithSpread: parseFloat(exitPriceWithSpread.toFixed(5)),
      direction,
      result,
      volume: VOLUME,
      QuotedSpent: parseFloat(QuotedSpent.toFixed(2)),
      QuotedReceived: parseFloat(QuotedReceived.toFixed(2)),
      profitQuoted: parseFloat(profitQuoted.toFixed(2)),
      spreadUsed: SPREAD,
    });

    lastTradeTime = curr.time;
  }

  return trades;
}

module.exports = { runStrategySMAS };
