const { BybitWSClient } = require("./ws/client");
const { getLastTwoHoursMoveETH } = require("./rest/marketData");
const { openIsolatedLongLimit } = require("./rest/order");
const { openIsolatedLongMarket } = require("./rest/marketorder");
const { syncServerTime } = require("./rest/client");
const { privateRequest } = require("./rest/client");
let strategyInterval = null;
let isInPosition = false;
let isStrategyRunning = false;


// ================= CONFIG =================
const STRATEGY_CONFIG = {
  symbol: "ETHUSDT",

  minPercent: -2.0,
  maxPercent: -14.0,

  order: {
    qty: 0.01,
    leverage: 5,
    priceOffsetPercent: -0.2,
    takeProfitPercent: 1,
  }
};


// ================= STRATEGY =================
async function checkEthStrategy() {
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

    const result = await getLastTwoHoursMoveETH();
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
      console.log("❌ Strategy conditions not met");
      return;
    }

    console.log("✅ Strategy conditions met");

    const limitPrice =
      result.endPrice *
      (1 + STRATEGY_CONFIG.order.priceOffsetPercent / 100);
    const takeProfitPrice =
      result.endPrice + result.endPrice * (STRATEGY_CONFIG.order.takeProfitPercent / 100);
    console.log(`📈 Placing order at $${limitPrice.toFixed(2)}, TP at $${takeProfitPrice.toFixed(2)}`);
   
    await openIsolatedLongLimit({
      symbol: STRATEGY_CONFIG.symbol,
      qty: STRATEGY_CONFIG.order.qty,
      price: 2000,
      leverage: STRATEGY_CONFIG.order.leverage,
      takeProfit: takeProfitPrice,
    });

    await openIsolatedLongMarket({
      symbol: STRATEGY_CONFIG.symbol,
      qty: STRATEGY_CONFIG.order.qty,
      leverage: STRATEGY_CONFIG.order.leverage,
      takeProfit: takeProfitPrice,
    });
    const ppofet = 2600;
    return privateRequest("POST", "/v5/position/trading-stop", {
      category: "linear",
      symbol : STRATEGY_CONFIG.symbol,
      takeProfit: ppofet.toString(), // Bybit любит строки
      tpTriggerBy: "LastPrice",
    });

    console.log("📥 Limit order placed");

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
    1 * 30 * 1000,
    checkEthStrategy
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

function runEveryAligned(intervalMs, task) {
  let stopped = false;
  let timeoutId = null;

  async function scheduleNext() {
    if (stopped) return;

    const now = Date.now();
    const nextTick = Math.ceil(now / intervalMs) * intervalMs;
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
      onPositionClose: async () => {
        console.log("🧹 Position closed — cleaning orders");

        isInPosition = false;

        try {
          await cancelAllOrders(STRATEGY_CONFIG.symbol);
        } catch (e) {
          console.error("❌ Failed to cancel orders:", e.message);
        }

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
