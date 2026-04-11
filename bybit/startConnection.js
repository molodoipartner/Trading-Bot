const { BybitWSClient } = require("./ws/client");
const { getLastTwoCandlesMoveETH } = require("./rest/marketData");
const { getVolatilityScoreETH } = require("./rest/getVolatilityScoreETH");
const { getLiquiditySweepETH } = require("./rest/getLiquiditySweepETH");
const { openIsolatedLongLimit } = require("./rest/order");
const { openIsolatedLongMarket } = require("./rest/marketorder");
const { syncServerTime } = require("./rest/client");
const { privateRequest } = require("./rest/client");
let strategyInterval = null;
let isInPosition = false;
let isStrategyRunning = false;
let tpUpdateLock = false;

let currentEntryPrice1 = null;
let currentEntryPrice2 = null;
let currentEntryPrice3 = null;
let currentEntryPrice4 = null;
let currentEntryPrice5 = null;
let currentVolumeForPosition1 = null;
let currentVolumeForPosition2 = null;
let currentVolumeForPosition3 = null;
let currentVolumeForPosition4 = null;
let currentVolumeForPosition5 = null;
let updateTakeProfitCount = 0;

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

const VOLATILITY_CHECK_HOURS = [20, 21, 22, 23, 2, 3, 4];

const deposit = 1150; // общий депозит для расчёта объёмов (можно менять, не влияет на стратегию)
//const deposit = 650;
// ================= CONFIG =================
  const LOOKBACK_HOURS = 95;
  const SWING_RANGE = 14;
  const SWING_RANGE2 = 7;

const volume_indexMIN2 = 0.098;
const volume_indexMAX2 = 1;
const volume_LOOKBACK2 = 14; 
const STRATEGY_CONFIG = {
  //symbol: "XAUUSDT",
  symbol: "ETHUSDT",
  DISABLED_HOURS: [8, 9, 14, 16], // часы по серверному времени
  //DISABLED_HOURS: [6, 13, 14, 17, 18, 19, 20, 21, 22, 23], // часы по серверному времени    
  //minPercent: -0.157,
  //maxPercent: -0.267,
  minPercent: -0.505,
  maxPercent: -0.8,
  minPercent2: -1.22,
  maxPercent2: -2,


  order: {
    //leverage: 10,
    //takeProfitPercent: 0.32,
    leverage: 3.7,
    takeProfitPercent: 0.97,
    //takeProfitPercent: 0.53,
  },

  deposit: deposit,

  volumes: expoVolumesFromTotal(deposit, 1.195, 1, 5),
  addPercents: expoPercents(0.01, 1.48, 4.22, 5)
  //volumes: expoVolumesFromTotal(deposit, 1.2, 1, 5),
  //addPercents: expoPercents(0.01, 1.11, 18, 5)
    //volumes: expoVolumesFromTotal(deposit, 1.195, 1, 5),
  //addPercents: expoPercents(0.01, 1.48, 4.22, 5)
  //const volumes = expo(500, 1.142, 1);
  //const addPercents = expo(0.01, 1.54, 4.02);
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

    const Volatilityresult = await getVolatilityScoreETH(volume_LOOKBACK2);
    
      if ((Volatilityresult.score < volume_indexMIN2 || Volatilityresult.score > volume_indexMAX2) && !VOLATILITY_CHECK_HOURS.includes(currentHour)) {
        console.log(
          `⛔ Volatility ${Volatilityresult}% out of ranges (${volume_indexMIN2}% .. ${volume_indexMAX2}%)`
        );
        console.log("❌ Strategy conditions not met");
        console.log("Volatility", Volatilityresult);
        return;
      } else {
        console.log("Volatility ✅", Volatilityresult);
      }

      const result = await getLiquiditySweepETH(LOOKBACK_HOURS, SWING_RANGE, SWING_RANGE2);

      if (!result.canbeopened) {
        console.log("❌ No entry yet", result);
        return
      } 

      // 🔥 вот твой сигнал
      console.log("ENTRY READY", result);


    /*
    const result = await getLastTwoCandlesMoveETH();
    console.log("ETH 2h move data:", result);
    console.log(
      `ETH 2h move: ${result.percentChange.toFixed(2)}%`
    );

    const p = result.percentChange;

    // --- ПЕРВАЯ ЗОНА ---
    const low1 = Math.min(
      STRATEGY_CONFIG.minPercent,
      STRATEGY_CONFIG.maxPercent
    );

    const high1 = Math.max(
      STRATEGY_CONFIG.minPercent,
      STRATEGY_CONFIG.maxPercent
    );

    // --- ВТОРАЯ ЗОНА (НОВАЯ) ---
    const low2 = Math.min(
      STRATEGY_CONFIG.minPercent2,
      STRATEGY_CONFIG.maxPercent2
    );

    const high2 = Math.max(
      STRATEGY_CONFIG.minPercent2,
      STRATEGY_CONFIG.maxPercent2
    );

    // Проверяем попадание в первую зону
    const inRange1 = p >= low1 && p <= high1;

    // Проверяем попадание во вторую зону
    const inRange2 = p >= low2 && p <= high2;

    // Если не попало ни в одну из зон
    if (!inRange1 && !inRange2) {
      console.log(
        `⛔ Move ${p.toFixed(2)}% out of ranges (${low1}% .. ${high1}%) OR (${low2}% .. ${high2}%)`
      );
      console.log("❌ Strategy conditions not met");
      return;
    }

    console.log("✅ Strategy conditions met");
    */

    const takeProfitPrice =
      result.endPrice + result.endPrice * (STRATEGY_CONFIG.order.takeProfitPercent / 100);
    console.log(`📈 Placing order at $${result.endPrice.toFixed(2)}, TP at $${takeProfitPrice.toFixed(2)}`);
   
      //For every entry type
      const leverage = STRATEGY_CONFIG.order.leverage;
      //const MIN_QTY = 0.001;
      //const QTY_STEP = 0.001;
      const MIN_QTY = 0.01;
      const QTY_STEP = 0.01;
      function roundToStep(value, step) {
        const precision = step.toString().split(".")[1]?.length || 0;
        const rounded = Math.floor(value / step) * step;
        return Number(rounded.toFixed(precision));
      }
      // ---------- MARKET ORDER WITH LEVERAGE ----------

      const volumeUSDT0 = STRATEGY_CONFIG.volumes[0];
      //const volumeUSDT0 = 190;
      const positionValueUSDT0 = volumeUSDT0 * leverage;
      let qtyETH0 = positionValueUSDT0 / result.endPrice;
      const RawQtyETH0 = qtyETH0;
      qtyETH0 = Math.floor(qtyETH0 / QTY_STEP) * QTY_STEP;
      qtyETH0 = roundToStep(qtyETH0, QTY_STEP);
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


      currentEntryPrice1 = result.endPrice;
      currentVolumeForPosition1 = volumeUSDT0;

      // ---------- LIMIT ORDER 1 WITH LEVERAGE ----------
      const price = Number(
        (result.endPrice - (result.endPrice * STRATEGY_CONFIG.addPercents[0])).toFixed(2)
      );
      const volumeUSDT = STRATEGY_CONFIG.volumes[1];
      //const volumeUSDT = 228;
      const positionValueUSDT = volumeUSDT * leverage;
      let qtyETH = positionValueUSDT / price;
      const RawQtyETH = qtyETH;
      qtyETH = Math.floor(qtyETH / QTY_STEP) * QTY_STEP;
      qtyETH = roundToStep(qtyETH, QTY_STEP);
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
      
      currentEntryPrice2 = price;
      currentVolumeForPosition2 = volumeUSDT;

      // ---------- LIMIT ORDER 2 WITH LEVERAGE ----------
      const price2 = Number(
        (price - (price * STRATEGY_CONFIG.addPercents[1])).toFixed(2)
      );
      const volumeUSDT2 = STRATEGY_CONFIG.volumes[2];
      //const volumeUSDT2 = 273.6;
      const positionValueUSDT2 = volumeUSDT2 * leverage;
      let qtyETH2 = positionValueUSDT2 / price2;
      const RawQtyETH2 = qtyETH2;
      qtyETH2 = Math.floor(qtyETH2 / QTY_STEP) * QTY_STEP;
      qtyETH2 = roundToStep(qtyETH2, QTY_STEP);
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
    
      currentEntryPrice3 = price2;
      currentVolumeForPosition3 = volumeUSDT2;

      // ---------- LIMIT ORDER 3 WITH LEVERAGE ----------
      const price3 = Number(
        (price2 - (price2 * STRATEGY_CONFIG.addPercents[2])).toFixed(2)
      );
      const volumeUSDT3 = STRATEGY_CONFIG.volumes[3];
      const positionValueUSDT3 = volumeUSDT3 * leverage;
      let qtyETH3 = positionValueUSDT3 / price3;
      const RawQtyETH3 = qtyETH3;
      qtyETH3 = Math.floor(qtyETH3 / QTY_STEP) * QTY_STEP;
      qtyETH3 = roundToStep(qtyETH3, QTY_STEP);
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

      currentEntryPrice4 = price3;
      currentVolumeForPosition4 = volumeUSDT3;

      // ---------- LIMIT ORDER 4 WITH LEVERAGE ----------
      const price4 = Number(
        (price3 - (price3 * STRATEGY_CONFIG.addPercents[3])).toFixed(2)
      );
      const volumeUSDT4 = STRATEGY_CONFIG.volumes[4];
      const positionValueUSDT4 = volumeUSDT4 * leverage;
      let qtyETH4 = positionValueUSDT4 / price4;
      const RawQtyETH4 = qtyETH4;
      qtyETH4 = Math.floor(qtyETH4 / QTY_STEP) * QTY_STEP;
      qtyETH4 = roundToStep(qtyETH4, QTY_STEP);
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

      currentEntryPrice5 = price4;
      currentVolumeForPosition5 = volumeUSDT4;


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
    5 * 60 * 1000, // каждые 5 минут
    checkEthStrategy,
    1000           // +1 секунда после закрытия свечи
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

function calculateAvgEntry(callNumber) {
  const prices = [
    currentEntryPrice1,
    currentEntryPrice2,
    currentEntryPrice3,
    currentEntryPrice4,
    currentEntryPrice5,
  ];

  const volumes = [
    currentVolumeForPosition1,
    currentVolumeForPosition2,
    currentVolumeForPosition3,
    currentVolumeForPosition4,
    currentVolumeForPosition5,
  ];

  let totalMoney = 0;
  let totalAsset = 0;

  // Берём позиции до callNumber + 1
  for (let i = 0; i <= callNumber; i++) {
    const price = Number(prices[i]);
    const volume = Number(volumes[i]);

    if (!price || !volume) continue;

    totalMoney += volume;
    totalAsset += volume / price;
  }

  if (totalAsset === 0) return 0;

  return totalMoney / totalAsset;
}


async function updateTakeProfitFromPosition(position, callNumber) {
  const { size, avgPrice: exchangeAvgPrice } = position;

  if (!Number(size)) return;

  const calculatedAvgPrice = calculateAvgEntry(callNumber);

  // ---- считаем разницу в процентах ----
  const diffPercent =
    Math.abs(calculatedAvgPrice - exchangeAvgPrice) /
    exchangeAvgPrice * 100;

  const MAX_DIFF_PERCENT = 0.2; // можно настроить (0.1–0.5%)

  let finalAvgPrice = calculatedAvgPrice;

  if (diffPercent > MAX_DIFF_PERCENT) {
    console.warn("⚠️ AVG PRICE MISMATCH!", {
      callNumber,
      exchangeAvgPrice,
      calculatedAvgPrice,
      diffPercent: diffPercent.toFixed(4) + "%",
      action: "USING EXCHANGE AVG PRICE"
    });

    finalAvgPrice = exchangeAvgPrice;
  } else {
    console.log("✅ AVG PRICE OK", {
      callNumber,
      exchangeAvgPrice,
      calculatedAvgPrice,
      diffPercent: diffPercent.toFixed(4) + "%"
    });
  }

  const symbol = STRATEGY_CONFIG.symbol;

  const tp = calcTakeProfit(
    Number(finalAvgPrice),
    STRATEGY_CONFIG.order.takeProfitPercent
  );

  console.log("🎯 Updating TP:", {
    usedAvgPrice: finalAvgPrice,
    size,
    tp: tp.toFixed(2),
  });

  // ---------- GET ACTIVE ORDERS ----------
  const orders = await privateRequest(
    "GET",
    "/v5/order/realtime",
    {
      category: "linear",
      symbol
    }
  );

  const reduceOnlyOrders = orders.result.list.filter(o => o.reduceOnly);

  // ---------- CANCEL OLD REDUCE ONLY ----------
  for (const order of reduceOnlyOrders) {
    await privateRequest(
      "POST",
      "/v5/order/cancel",
      {
        category: "linear",
        symbol,
        orderId: order.orderId
      }
    );

    console.log("❌ Cancelled old TP:", order.orderId);
  }

  // ---------- CREATE NEW LIMIT TP ----------
  const tpPayload = {
    category: "linear",
    symbol,
    side: "Sell",
    orderType: "Limit",
    qty: size.toString(),
    price: tp.toFixed(2),
    reduceOnly: true
  };

  const result = await privateRequest(
    "POST",
    "/v5/order/create",
    tpPayload
  );

  console.log("🎯 New Take Profit LIMIT placed:", result.result);
}



async function cancelAllOrders(symbol) {
  console.log("🧹 Cancelling all open orders for", symbol);
  currentEntryPrice1 = null;
  currentEntryPrice2 = null;
  currentEntryPrice3 = null;
  currentEntryPrice4 = null;
  currentEntryPrice5 = null;
  currentVolumeForPosition1 = null;
  currentVolumeForPosition2 = null;
  currentVolumeForPosition3 = null;
  currentVolumeForPosition4 = null;
  currentVolumeForPosition5 = null;
  updateTakeProfitCount = 0;
  
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

      onExecution: async (execution) => {
          
        // игнорируем funding и прочее
       console.log(JSON.stringify(execution, null, 2));
        if (execution.execType !== "Trade") return;
        console.log("Execution Passed!")
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
          updateTakeProfitCount++;
          await updateTakeProfitFromPosition(position, updateTakeProfitCount);

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
