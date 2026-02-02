const { privateRequest } = require("./client");

async function openLongLimit({
  symbol,
  qty,
  price,
  leverage,
  takeProfit,
  marginMode = "isolated" // "isolated" | "cross"
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

  // ---------- BUILD ORDER ----------
  const orderPayload = {
    category: "linear",
    symbol,
    side: "Buy",
    orderType: "Limit",
    qty: qty.toString(),
    price: price.toString(),
    timeInForce: "GTC",
    reduceOnly: false,
    closeOnTrigger: false,
  };

  if (typeof takeProfit === "number" && takeProfit > 0) {
    orderPayload.takeProfit = takeProfit.toString();
    orderPayload.tpTriggerBy = "LastPrice";
  }

  // ---------- PLACE ORDER ----------
  const res = await privateRequest(
    "POST",
    "/v5/order/create",
    orderPayload
  );

  return res.result;
}

module.exports = {
  openLongLimit,
};
