const fs = require("fs");
const csv = require("csv-parser");

/**
 * ===== ЗАГРУЗКА SMA ИЗ CSV =====
 * CSV формат:
 * time,sma
 */
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

/**
 * ===== ОСНОВНАЯ СТРАТЕГИЯ =====
 */
const runStrategyEveryHour = async (candles, config) => {
  console.log("runStrategyEveryHour with MA phases");

  const {
    VOLUME,
    SPREAD,
    TP_PIPS,
    SL_PIPS,
    ALLOWED_HOURS,
    ALLOWED_PHASES,
    smaPath1,
    smaPath2,
  } = config;

  // Загружаем SMA
  const smaFast = await loadSMA(smaPath1);
  const smaSlow = await loadSMA(smaPath2);

  const trades = [];

  // Уникальный ключ "дата + час", чтобы не было бага с одним часом
  let lastEntryKey = null;

  // Текущая фаза рынка
  let phase = null; // "BULL" | "BEAR"

  for (let i = 1; i < candles.length; i++) {
    const curr = candles[i];

    const sma1 = smaFast.get(curr.time);
    const sma2 = smaSlow.get(curr.time);

    // Если нет данных SMA — пропускаем
    if (sma1 == null || sma2 == null) continue;

    // ===== ОПРЕДЕЛЕНИЕ ФАЗЫ =====
    if (sma1 > sma2) phase = "BULL";
    else if (sma1 < sma2) phase = "BEAR";
    else continue;

    const [datePart, timePart] = curr.time.split(" ");
    const [hh, mm] = timePart.split(":");
    const hour = parseInt(hh, 10);

    // ===== ПРОВЕРКА НОВОГО ЧАСА (С УЧЁТОМ ДАТЫ) =====
    const entryKey = `${datePart} ${hh}`; // YYYY-MM-DD HH
    const isNewHour = mm === "00" && entryKey !== lastEntryKey;

    const isAllowedHour =
      !ALLOWED_HOURS || ALLOWED_HOURS.includes(hour);

    if (!isNewHour || !isAllowedHour) continue;

    // ===== ФИЛЬТР ФАЗ =====
    if (
      ALLOWED_PHASES &&
      !ALLOWED_PHASES.includes(phase)
    ) {
      continue;
    }

    lastEntryKey = entryKey;

    // ===== НАПРАВЛЕНИЕ СДЕЛКИ =====
    const direction = phase === "BULL" ? "LONG" : "SHORT";

    const entryTime = curr.time;
    const entryPrice = curr.close;

    let takeProfit, stopLoss;

    if (direction === "LONG") {
      takeProfit = entryPrice + TP_PIPS;
      stopLoss  = entryPrice - SL_PIPS;
    } else {
      takeProfit = entryPrice - TP_PIPS;
      stopLoss  = entryPrice + SL_PIPS;
    }

    let exitTime = entryTime;
    let exitPrice = entryPrice;
    let result = "NONE";

    // ===== ПОИСК ВЫХОДА =====
    for (let j = i + 1; j < candles.length; j++) {
      const c = candles[j];

      if (direction === "LONG") {
        if (c.high >= takeProfit) {
          exitPrice = takeProfit;
          exitTime = c.time;
          result = "TAKE";
          break;
        }
        if (c.low <= stopLoss) {
          exitPrice = stopLoss;
          exitTime = c.time;
          result = "STOP";
          break;
        }
      } else {
        if (c.low <= takeProfit) {
          exitPrice = takeProfit;
          exitTime = c.time;
          result = "TAKE";
          break;
        }
        if (c.high >= stopLoss) {
          exitPrice = stopLoss;
          exitTime = c.time;
          result = "STOP";
          break;
        }
      }
    }

    if (result === "NONE") continue;

// ===== УЧЁТ СПРЕДА =====
const entryWithSpread =
  direction === "LONG"
    ? entryPrice + SPREAD / 2
    : entryPrice - SPREAD / 2;

const exitWithSpread =
  direction === "LONG"
    ? exitPrice - SPREAD / 2
    : exitPrice + SPREAD / 2;

// ===== ПРАВИЛЬНЫЙ РАСЧЁТ ПРОФИТА =====
let profitQuoted;

if (direction === "LONG") {
  profitQuoted = (exitWithSpread - entryWithSpread) * VOLUME;
} else {
  profitQuoted = (entryWithSpread - exitWithSpread) * VOLUME;
}


    trades.push({
      entryTime,
      entryPrice,
      entryPriceWithSpread: entryWithSpread,
      stopLoss,
      takeProfit,
      exitTime,
      exitPrice,
      exitPriceWithSpread: exitWithSpread,
      direction,
      phase,
      result,
      volume: VOLUME,
      profitQuoted,
      spreadUsed: SPREAD,
    });
  }

  return trades;
};

module.exports = {
  runStrategyEveryHour,
};
