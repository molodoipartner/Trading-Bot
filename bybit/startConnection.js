const { BybitWSClient } = require("./ws/client");
const { getLastTwoCandlesMoveETH } = require("./rest/marketData");
const { openIsolatedLongLimit } = require("./rest/order");
const { openIsolatedLongMarket } = require("./rest/marketorder");
const { syncServerTime } = require("./rest/client");
const { privateRequest } = require("./rest/client");
let strategyInterval = null;
let isInPosition = false;
let isStrategyRunning = false;
let tpUpdateLock = false;




function expoVolumesFromTotal(
  totalAmount,   // общий депозит (например 1000)
  growth,        // 1.16
  scale,         // 1
  levels,    // количество позиций
  precision = 6
) {
  const rawWeights = [];

  // 1️⃣ Генерируем экспоненциальные веса
  for (let i = 0; i < levels; i++) {
    const w = 1 + scale * (Math.pow(growth, i) - 1);
    rawWeights.push(w);
  }

  // 2️⃣ Нормализация под общий депозит
  const weightSum = rawWeights.reduce((a, b) => a + b, 0);

  return rawWeights.map(w =>
    Number(((w / weightSum) * totalAmount).toFixed(precision))
  );
}


function expoPercents(
  basePercent,   // 0.01
  growth,        // 1.55
  scale,         // 3.9
  levels = 5,
  precision = 6
) {
  const values = [];

  for (let i = 0; i < levels; i++) {
    const value =
      basePercent * (1 + scale * (Math.pow(growth, i) - 1));

    values.push(Number(value.toFixed(precision)));
  }

  return values;
}


const deposit = 580;
// ================= CONFIG =================
const STRATEGY_CONFIG = {
  symbol: "ETHUSDT",
  DISABLED_HOURS: [2, 13, 14, 17, 18, 19, 20, 21, 22, 23], // часы по серверному времени
          
  minPercent: -0.52,
  maxPercent: -3,

  order: {
    leverage: 4,
    takeProfitPercent: 1.1,
  },

  deposit: deposit,
  expo: {
    volume: {
      growth: 1.16,
      scale: 1
    },
    percent: {
      growth: 1.55,
      scale: 3.9
    }
  },

  volumes: expoVolumesFromTotal(deposit, 1.148, 1, 5),
  addPercents: expoPercents(0.01, 1.523, 4.19, 5)
};

console.log("Strategy:", STRATEGY_CONFIG);
// ================= STRATEGY =================

async function checkEthStrategy() {

  const now = new Date();
  const currentHour = now.getHours();

  if (STRATEGY_CONFIG.DISABLED_HOURS.includes(currentHour)) {
    console.log(`⛔ Strategy disabled at ${currentHour}:00 hour`);
    return;
  }

  if (isInPosition) {
    console.log("⛔ In position — strategy skipped");
    return;
  }

  if (isStrategyRunning) {
    console.log("⏳ Strategy already running — skipped");
    return;
  }

  isStrategyRunning = true;

  try {
    console.log("⏱ Checking ETH strategy...");

    const result = await getLastTwoCandlesMoveETH();
    console.log("ETH 2h move data:", result);
    console.log(
      `ETH 2h move: ${result.percentChange.toFixed(2)}%`
    );
    const p = result.percentChange;

    const low = Math.min(
      STRATEGY_CONFIG.minPercent,
      STRATEGY_CONFIG.maxPercent
    );

    const high = Math.max(
      STRATEGY_CONFIG.minPercent,
      STRATEGY_CONFIG.maxPercent
    );

    if (p < low || p > high) {
      console.log(`⛔ Move ${p.toFixed(2)}% out of range (${low}% .. ${high}%)`);
      console.log("❌ Strategy conditions not met");
      return;
    }

    console.log("✅ Strategy conditions met");

    const takeProfitPrice =
      result.endPrice + result.endPrice * (STRATEGY_CONFIG.order.takeProfitPercent / 100);
    console.log(`📈 Placing order at $${result.endPrice.toFixed(2)}, TP at $${takeProfitPrice.toFixed(2)}`);
   
      //For every entry type
      const leverage = STRATEGY_CONFIG.order.leverage;
      const MIN_QTY = 0.01;
      const QTY_STEP = 0.01;
      // ---------- MARKET ORDER WITH LEVERAGE ----------

      const volumeUSDT0 = STRATEGY_CONFIG.volumes[0];
      const positionValueUSDT0 = volumeUSDT0 * leverage;
      let qtyETH0 = positionValueUSDT0 / result.endPrice;
      const RawQtyETH0 = qtyETH0;
      qtyETH0 = Math.floor(qtyETH0 / QTY_STEP) * QTY_STEP;
      if (qtyETH0 < MIN_QTY) {
        console.log("⛔ qty below minOrderQty:", qtyETH0);
        return;
      }
      console.log("📌 MARKET(LIMIT) ORDER WITH LEVERAGE", {
        marginUSDT: volumeUSDT0,
        leverage,
        positionValueUSDT: positionValueUSDT0,
        price: result.endPrice,
        qtyETH: qtyETH0,
      },"RawQtyETH:", RawQtyETH0)
      await openIsolatedLongMarket({
        symbol: STRATEGY_CONFIG.symbol,
        qty: qtyETH0,
        leverage: STRATEGY_CONFIG.order.leverage,
        takeProfit: takeProfitPrice,
      });

      // ---------- LIMIT ORDER 1 WITH LEVERAGE ----------
      const price = Number(
        (result.endPrice - (result.endPrice * STRATEGY_CONFIG.addPercents[0])).toFixed(2)
      );
      const volumeUSDT = STRATEGY_CONFIG.volumes[1];
      const positionValueUSDT = volumeUSDT * leverage;
      let qtyETH = positionValueUSDT / price;
      const RawQtyETH = qtyETH;
      qtyETH = Math.floor(qtyETH / QTY_STEP) * QTY_STEP;
      if (qtyETH < MIN_QTY) {
        console.log("⛔ qty below minOrderQty:", qtyETH);
        return;
      }
      console.log("📌 LIMIT ORDER 1 WITH LEVERAGE", {
        CalculatedLimitPrice: price,
        Percent: STRATEGY_CONFIG.addPercents[0],
        marginUSDT: volumeUSDT,
        leverage,
        positionValueUSDT,
        qtyETH,
      },"RawQtyETH:", RawQtyETH);
      await openIsolatedLongLimit({
        symbol: STRATEGY_CONFIG.symbol,
        qty: qtyETH,          // ✅ ПОЛНЫЙ размер позиции
        price,
        leverage,             // ✅ плечо отдельно
      });
 
      // ---------- LIMIT ORDER 2 WITH LEVERAGE ----------
      const price2 = Number(
        (result.endPrice - (result.endPrice * STRATEGY_CONFIG.addPercents[1])).toFixed(2)
      );
      const volumeUSDT2 = STRATEGY_CONFIG.volumes[2];
      const positionValueUSDT2 = volumeUSDT2 * leverage;
      let qtyETH2 = positionValueUSDT2 / price2;
      const RawQtyETH2 = qtyETH2;
      qtyETH2 = Math.floor(qtyETH2 / QTY_STEP) * QTY_STEP;
      if (qtyETH2 < MIN_QTY) {
        console.log("⛔ qty below minOrderQty:", qtyETH2);
        return;
      }
      console.log("📌 LIMIT ORDER 2 WITH LEVERAGE", {
        CalculatedLimitPrice: price2,
        Percent: STRATEGY_CONFIG.addPercents[1],
        marginUSDT: volumeUSDT2,
        leverage,
        positionValueUSDT: positionValueUSDT2,
        qtyETH: qtyETH2,
      },"RawQtyETH:", RawQtyETH2);
      await openIsolatedLongLimit({
        symbol: STRATEGY_CONFIG.symbol,
        qty: qtyETH2,          // ✅ ПОЛНЫЙ размер позиции
        price: price2,
        leverage,             // ✅ плечо отдельно
      });
    
      // ---------- LIMIT ORDER 3 WITH LEVERAGE ----------
      const price3 = Number(
        (result.endPrice - (result.endPrice * STRATEGY_CONFIG.addPercents[2])).toFixed(2)
      );
      const volumeUSDT3 = STRATEGY_CONFIG.volumes[3];
      const positionValueUSDT3 = volumeUSDT3 * leverage;
      let qtyETH3 = positionValueUSDT3 / price3;
      const RawQtyETH3 = qtyETH3;
      qtyETH3 = Math.floor(qtyETH3 / QTY_STEP) * QTY_STEP;
      if (qtyETH3 < MIN_QTY) {
        console.log("⛔ qty below minOrderQty:", qtyETH3);
        return;
      }
      console.log("📌 LIMIT ORDER 3 WITH LEVERAGE", {
        CalculatedLimitPrice: price3,
        Percent: STRATEGY_CONFIG.addPercents[2],
        marginUSDT: volumeUSDT3,
        leverage,
        positionValueUSDT: positionValueUSDT3,
        qtyETH: qtyETH3,
      },"RawQtyETH:", RawQtyETH3);
      await openIsolatedLongLimit({
        symbol: STRATEGY_CONFIG.symbol,
        qty: qtyETH3,          // ✅ ПОЛНЫЙ размер позиции
        price: price3,
        leverage,             // ✅ плечо отдельно
      });

      // ---------- LIMIT ORDER 4 WITH LEVERAGE ----------
      const price4 = Number(
        (result.endPrice - (result.endPrice * STRATEGY_CONFIG.addPercents[3])).toFixed(2)
      );
      const volumeUSDT4 = STRATEGY_CONFIG.volumes[4];
      const positionValueUSDT4 = volumeUSDT4 * leverage;
      let qtyETH4 = positionValueUSDT4 / price4;
      const RawQtyETH4 = qtyETH4;
      qtyETH4 = Math.floor(qtyETH4 / QTY_STEP) * QTY_STEP;
      if (qtyETH4 < MIN_QTY) {
        console.log("⛔ qty below minOrderQty:", qtyETH4);
        return;
      }
      console.log("📌 LIMIT ORDER 4 WITH LEVERAGE", {
        CalculatedLimitPrice: price4,
        Percent: STRATEGY_CONFIG.addPercents[3],
        marginUSDT: volumeUSDT4,
        leverage,
        positionValueUSDT: positionValueUSDT4,
        qtyETH: qtyETH4,
      },"RawQtyETH:", RawQtyETH4);
      await openIsolatedLongLimit({
        symbol: STRATEGY_CONFIG.symbol,
        qty: qtyETH4,          // ✅ ПОЛНЫЙ размер позиции
        price: price4,
        leverage,             // ✅ плечо отдельно
      });

    console.log("✅ All orders placed successfully");

  } catch (e) {
    console.error("🔥 Strategy error:", e.message);
  } finally {
    isStrategyRunning = false;
  }
}

function startStrategy() {
  if (strategyInterval) return;

  console.log("▶️ Strategy STARTED");

  strategyInterval = runEveryAligned(
    30 * 60 * 1000,   // 30 минут
    checkEthStrategy,
    301 * 1000    // ⏱ +5 минут сдвиг
  );
}


function stopStrategy() {
  if (!strategyInterval) return;

  console.log("⏸ Strategy STOPPED");
  strategyInterval(); // ⬅️ корректная остановка
  strategyInterval = null;
}


async function hasOpenPosition(symbol) {
  const res = await privateRequest("GET", "/v5/position/list", {
    category: "linear",
    symbol,
  });

  const position = res.result.list[0];
  return position && Number(position.size) > 0;
}

function runEveryAligned(intervalMs, task, offsetMs = 0) {
  let stopped = false;
  let timeoutId = null;

  async function scheduleNext() {
    if (stopped) return;

    const now = Date.now();

    // базовое выравнивание
    let nextTick =
      Math.ceil((now - offsetMs) / intervalMs) * intervalMs + offsetMs;

    // защита: если вдруг попали в прошлое
    if (nextTick <= now) {
      nextTick += intervalMs;
    }

    const delay = nextTick - now;

    timeoutId = setTimeout(async () => {
      try {
        await task();
      } catch (e) {
        console.error("🔥 Scheduled task error:", e.message);
      } finally {
        scheduleNext();
      }
    }, delay);
  }

  scheduleNext();

  return () => {
    stopped = true;
    if (timeoutId) clearTimeout(timeoutId);
  };
}

function calcTakeProfit(entryPrice, percent = STRATEGY_CONFIG.order.takeProfitPercent) {
  const multiplier = percent / 100;
  return entryPrice + (entryPrice * multiplier);
}

async function updateTakeProfitFromPosition(position) {
  const { avgPrice, size } = position;

  if (!Number(size)) return;

  const tp = calcTakeProfit(Number(avgPrice), STRATEGY_CONFIG.order.takeProfitPercent);

  console.log("🎯 Updating TP:", {
    avgPrice,
    size,
    tp: tp.toFixed(2),
  });

  await privateRequest("POST", "/v5/position/trading-stop", {
    category: "linear",
    symbol: STRATEGY_CONFIG.symbol,
    takeProfit: tp.toFixed(2),
    tpTriggerBy: "LastPrice",
  });
}



async function cancelAllOrders(symbol) {
  console.log("🧹 Cancelling all open orders for", symbol);

  await privateRequest("POST", "/v5/order/cancel-all", {
    category: "linear",
    symbol,
  });

  console.log("✅ All open orders cancelled");
}


// ================= ENTRYPOINT =================
(async () => {
  try {
    console.log("🚀 Starting bot...");

    await syncServerTime();

    const wsClient = new BybitWSClient({
      onPositionOpen: () => {
        isInPosition = true;
        stopStrategy();
      },

      onExecution: async () => {
        if (!isInPosition || tpUpdateLock) return;

        tpUpdateLock = true;

        try {
          const res = await privateRequest("GET", "/v5/position/list", {
            category: "linear",
            symbol: STRATEGY_CONFIG.symbol,
          });
          console.log("🔄 Fetched position for TP update:", res.result.list);
          const position = res?.result?.list?.find(
            p => Number(p.size) > 0
          );

          if (!position) {
            console.log("⚠️ No open position found");
            return;
          }

          await updateTakeProfitFromPosition(position);

        } catch (e) {
          console.error("❌ Failed to update TP:", e.message);
        } finally {
          setTimeout(() => {
            tpUpdateLock = false;
          }, 300);
        }
      },


      onPositionClose: async () => {
        isInPosition = false;
        await cancelAllOrders(STRATEGY_CONFIG.symbol);
        startStrategy();
      }
    });

    wsClient.connect();
    await new Promise(r => setTimeout(r, 5500)); // fallback


    // 🔍 REST-проверка при старте
    isInPosition = await hasOpenPosition(STRATEGY_CONFIG.symbol);
    console.log("isInPosition (REST):", isInPosition);

    if (isInPosition) {
      console.log("⛔ Position already open — waiting via WS");
      wsClient.isInPosition = true;
    } else {
      startStrategy();
    }

  } catch (e) {
    console.error("🔥 Startup error:", e.message);
  }
})();
