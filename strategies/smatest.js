const fs = require('fs');
const readline = require('readline');
const path = require('path');

// Конфигурация
const CSV_PATH = path.resolve(__dirname, 'data.csv');
const TAKE_PROFIT_PIPS = 10; // В пунктах
const STOP_LOSS_PIPS = 10;   // В пунктах
const PIP_SIZE = 0.0001;     // Для EUR/USD

// Расчёт TP/SL в цене
const TP_DELTA = TAKE_PROFIT_PIPS * PIP_SIZE;
const SL_DELTA = STOP_LOSS_PIPS * PIP_SIZE;

// Статистика
let positions = []; 
let takeProfits = 0;
let stopLosses = 0;
let totalProfit = 0;

// Преобразует строку времени в объект Date
function parseTime(str) {
  return new Date(str.replace(' ', 'T') + 'Z');
}

// Проверка принадлежности времени к сессии
function isNewYorkSession(date) {
  const hour = date.getUTCHours();
  return hour >= 13 && hour < 22; // 13:00–21:59 UTC
}

async function backtest() {
  const fileStream = fs.createReadStream(CSV_PATH);

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let openPosition = null;

  for await (const line of rl) {
    if (!line.trim()) continue;

    const [timestamp, open, high, low, close] = line.split(',').map((v, i) =>
      i === 0 ? v : parseFloat(v)
    );

    const time = parseTime(timestamp);

    // Закрытие позиции если TP/SL достигнуты
    if (openPosition) {
      const { type, entry, tp, sl, time: entryTime } = openPosition;
      if (type === 'long') {
        if (high >= tp) {
          totalProfit += TP_DELTA;
          takeProfits++;
          openPosition = null;
          continue;
        } else if (low <= sl) {
          totalProfit -= SL_DELTA;
          stopLosses++;
          openPosition = null;
          continue;
        }
      } else if (type === 'short') {
        if (low <= tp) {
          totalProfit += TP_DELTA;
          takeProfits++;
          openPosition = null;
          continue;
        } else if (high >= sl) {
          totalProfit -= SL_DELTA;
          stopLosses++;
          openPosition = null;
          continue;
        }
      }
    }

    // Открытие позиции по началу сессии
    if (!openPosition && isNewYorkSession(time)) {
      const entryPrice = close;
      openPosition = {
        type: 'long', // Предположим только long (можно сделать чередование или стратегию)
        entry: entryPrice,
        tp: entryPrice + TP_DELTA,
        sl: entryPrice - SL_DELTA,
        time
      };
      positions.push(openPosition);
    }
  }

  // Финальный отчёт
  console.log(`📊 Результаты бэктеста:`);
  console.log(`Всего позиций: ${positions.length}`);
  console.log(`Тейк-профитов (TP): ${takeProfits}`);
  console.log(`Стоп-лоссов (SL): ${stopLosses}`);
  console.log(`Чистая прибыль: ${(totalProfit / PIP_SIZE).toFixed(1)} пунктов`);
  console.log(`Прибыль в валюте: ${totalProfit.toFixed(5)} (если 1 пункт = ${PIP_SIZE})`);
}

backtest();
