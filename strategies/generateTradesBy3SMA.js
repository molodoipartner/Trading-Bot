// runStrategy3SMA.js
const fs = require("fs");
const csv = require("csv-parser");

function loadSMA(path) {
  return new Promise((resolve, reject) => {
    const map = new Map();
    fs.createReadStream(path)
      .pipe(csv(["time", "sma"]))
      .on("data", (row) => {
        const time = row.time.trim();
        const value = parseFloat(row.sma);
        if (!isNaN(value)) {
          map.set(time, value);
        }
      })
      .on("end", () => resolve(map))
      .on("error", reject);
  });
}

async function runStrategy3SMA(candles, config) {
  console.log("runStrategy3SMA");

  const { timeStart = 0, timeEnd = 25 } = config;

  const VOLUME = config.VOLUME;
  const SPREAD = config.SPREAD;
  const smaPath1 = config.smaPath1;
  const smaPath2 = config.smaPath2;
  const smaPath3 = config.smaPath3; // <-- Новый путь к SMA3
  const sma1Map = await loadSMA(smaPath1);
  const sma2Map = await loadSMA(smaPath2);
  const sma3Map = await loadSMA(smaPath3); // <-- Загрузка SMA3

  const trades = [];
  let lastTradeTime = null;

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];

    const hour = parseInt(curr.time.split(" ")[1].split(":")[0], 10);
    if (timeEnd > timeStart) {
      if (hour < timeStart || hour >= timeEnd) continue;
    } else {
      if (hour < timeStart && hour >= timeEnd) continue;
    }

    const prevSMA1 = sma1Map.get(prev.time);
    const prevSMA2 = sma2Map.get(prev.time);
    const currSMA1 = sma1Map.get(curr.time);
    const currSMA2 = sma2Map.get(curr.time);
    const currSMA3 = sma3Map.get(curr.time); // <-- получаем SMA3
    const currPrice = curr.close;

    if (
      prevSMA1 === undefined || prevSMA2 === undefined ||
      currSMA1 === undefined || currSMA2 === undefined ||
      currSMA3 === undefined
    ) continue;

    const crossedUp = prevSMA1 <= prevSMA2 && currSMA1 > currSMA2;
    const crossedDown = prevSMA1 >= prevSMA2 && currSMA1 < currSMA2;

    let direction = null;

    // === Применяем фильтр SMA3 ===
    if (crossedUp && currPrice >= currSMA3) {
      direction = "LONG";
    } else if (crossedDown && currPrice <= currSMA3) {
      direction = "SHORT";
    } else {
      continue; // фильтр не прошёл, пропускаем
    }

    const entryTime = curr.time;
    const entryPrice = curr.close;
    let exitTime = entryTime;
    let exitPrice = entryPrice;
    let result = "NONE";
    let stopLoss = null;
    let takeProfit = null;

    for (let j = i + 1; j < candles.length; j++) {
      const prevExit = candles[j - 1];
      const currExit = candles[j];

      const prevExitSMA1 = sma1Map.get(prevExit.time);
      const prevExitSMA2 = sma2Map.get(prevExit.time);
      const currExitSMA1 = sma1Map.get(currExit.time);
      const currExitSMA2 = sma2Map.get(currExit.time);

      if (
        prevExitSMA1 === undefined || prevExitSMA2 === undefined ||
        currExitSMA1 === undefined || currExitSMA2 === undefined
      ) continue;

      const exitCrossLong = direction === "LONG" &&
        prevExitSMA1 >= prevExitSMA2 && currExitSMA1 < currExitSMA2;

      const exitCrossShort = direction === "SHORT" &&
        prevExitSMA1 <= prevExitSMA2 && currExitSMA1 > currExitSMA2;

      if (exitCrossLong || exitCrossShort) {
        exitTime = currExit.time;
        exitPrice = currExit.close;

        if (direction === "LONG") {
          result = exitPrice > entryPrice ? "TAKE" : "STOP";
          const adj = SPREAD / 2;
          takeProfit = result === "TAKE" ? parseFloat((exitPrice - adj).toFixed(5)) : null;
          stopLoss = result === "STOP" ? parseFloat((exitPrice - adj).toFixed(5)) : null;
        } else {
          result = exitPrice < entryPrice ? "TAKE" : "STOP";
          const adj = SPREAD / 2;
          takeProfit = result === "TAKE" ? parseFloat((exitPrice + adj).toFixed(5)) : null;
          stopLoss = result === "STOP" ? parseFloat((exitPrice + adj).toFixed(5)) : null;
        }

        break;
      }
    }

    const entryPriceRounded = parseFloat(entryPrice.toFixed(5));
    const exitPriceRounded = parseFloat(exitPrice.toFixed(5));

    const entryWithSpread = direction === "LONG"
      ? entryPriceRounded + SPREAD / 2
      : entryPriceRounded - SPREAD / 2;

    const exitWithSpread = direction === "LONG"
      ? exitPriceRounded - SPREAD / 2
      : exitPriceRounded + SPREAD / 2;

    const QuotedSpent = direction === "LONG"
      ? entryWithSpread * VOLUME
      : exitWithSpread * VOLUME;

    const QuotedReceived = direction === "LONG"
      ? exitWithSpread * VOLUME
      : entryWithSpread * VOLUME;

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

module.exports = { runStrategy3SMA };
