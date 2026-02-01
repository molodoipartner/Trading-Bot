const { privateRequest } = require("./client");

async function openIsolatedLongLimit({
  symbol,
  qty,
  price,
  leverage,
  takeProfit // может быть undefined
}) {

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

  // ---------- BUILD ORDER PAYLOAD ----------
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

  // ✅ ДОБАВЛЯЕМ TP ТОЛЬКО ЕСЛИ ОН ЕСТЬ
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
  openIsolatedLongLimit,
};
