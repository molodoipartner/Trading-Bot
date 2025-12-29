const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");

function loadSMA(smaPath = "backtest/sma1.csv") {
  return new Promise((resolve) => { 
    const sma = [];
    fs.createReadStream(smaPath)
      .pipe(csv(["time", "sma5"])) // Укажем явно имена столбцов
      .on("data", (row) => {
        const smaValue = parseFloat(row.sma5);
        if (!isNaN(smaValue)) {
          sma.push({
            time: row.time.trim(),
            sma: smaValue,
          });
        }
      })
      .on("end", () => resolve(sma));
  });
}


function findSMAForTime(time, smaArray) {
  return smaArray.find((s) => s.time === time)?.sma ?? null;
}

async function runStrategySMA(candles, config) {
  console.log("ALOOOO")
  let lastTradeTime = null;

  const { TP_PIPS = 0.0020, RISK_REWARD = 2, VOLUME = 2000, timeStart = 8, timeEnd = 20 } = config;
  const smaData = await loadSMA();
  const trades = [];

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];


    // Извлекаем часы из времени (формат "YYYY-MM-DD HH:MM:SS")
    const hour = parseInt(curr.time.split(" ")[1].split(":")[0], 10);

    // Фильтрация по времени: только между 08:00 и 20:00 (включительно)
    if (hour < timeStart || hour > timeEnd) continue;

    if (lastTradeTime) {
      const currentTime = new Date(curr.time);
      const lastTime = new Date(lastTradeTime);
      const diffMs = currentTime - lastTime;
      const diffMinutes = diffMs / (1000 * 60);
      if (diffMinutes < 60) continue;
    }

    const prevSMA = findSMAForTime(prev.time, smaData);
    const currSMA = findSMAForTime(curr.time, smaData);

    if (!prevSMA || !currSMA) continue;

    const crossedUp = prev.close < prevSMA && curr.close > currSMA;
    const crossedDown = prev.close > prevSMA && curr.close < currSMA;



    let direction = null;


    if (crossedUp) {
      direction = "LONG";
      console.log(candles.length)
    }
    else if (crossedDown) {
      direction = "SHORT";
      console.log(candles.length)
    }
    else continue;

    // 👉 Диагностика
    console.log("=== Пересечение ===");
    console.log("Время:", curr.time);
    console.log("Цена закрытия:", curr.close);
    console.log("SMA:", currSMA);
    console.log("Направление:", direction);
    console.log("-------------------");

    const entryTime = curr.time;
    const entryPrice = curr.close;

    const takeProfit =
      direction === "LONG"
        ? entryPrice + TP_PIPS
        : entryPrice - TP_PIPS;

    const stopLoss =
      direction === "LONG"
        ? entryPrice - TP_PIPS / RISK_REWARD
        : entryPrice + TP_PIPS / RISK_REWARD;

    let exitTime = entryTime;
    let exitPrice = entryPrice;
    let result = "NONE";

    // Поиск выхода
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
      volume: VOLUME,
    });
    lastTradeTime = curr.time;
  }

  return trades;
}

module.exports = { runStrategySMA };
