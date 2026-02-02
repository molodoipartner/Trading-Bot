const { privateRequest } = require("./client");

async function openIsolatedLongMarket({
  symbol,
  qty,
  leverage,
  takeProfit,
  marginMode = "isolated"
}) {
    // ---------- SET MARGIN MODE ----------
  try {
    await privateRequest("POST", "/v5/position/switch-isolated", {
      category: "linear",
      symbol,
      tradeMode: marginMode === "cross" ? 0 : 1,
      buyLeverage: leverage.toString(),
      sellLeverage: leverage.toString(),
    });
  } catch (e) {
    // Bybit часто отвечает, что режим уже установлен
    if (!e.message.includes("not modified")) {
      throw e;
    }
    console.log("ℹ️ Margin mode already set");
  }
  // ---------- SET LEVERAGE ----------
  try {
    await privateRequest("POST", "/v5/position/set-leverage", {
      category: "linear",
      symbol,
      buyLeverage: leverage.toString(),
      sellLeverage: leverage.toString(),
    });
  } catch (e) {
    if (!e.message.includes("leverage not modified")) {
      throw e;
    }
    console.log("ℹ️ Leverage already set");
  }

  // ---------- PLACE MARKET ORDER ----------
  const res = await privateRequest("POST", "/v5/order/create", {
    category: "linear",
    symbol,
    side: "Buy",
    takeProfit: takeProfit.toString(),
    orderType: "Market",
    qty: qty.toString(),
    timeInForce: "IOC",
    reduceOnly: false,
    closeOnTrigger: false,
  });

  return res.result;
}

module.exports = {
  openIsolatedLongMarket,
};
