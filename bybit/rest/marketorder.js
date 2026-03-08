const { privateRequest } = require("./client");

async function openIsolatedLongMarket({
  symbol,
  qty,
  leverage,
  takeProfit,
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
    if (!e.message?.includes("leverage not modified")) throw e;
  }

  // ---------- MARKET ORDER ----------
  const orderPayload = {
    category: "linear",
    symbol,
    side: "Buy",
    orderType: "Market",
    qty: qty.toString(),
    reduceOnly: false,
    closeOnTrigger: false,
  };

  const orderResult = await privateRequest(
    "POST",
    "/v5/order/create",
    orderPayload
  );

  console.log("✅ Market order opened");

  // ---------- PLACE TAKE PROFIT LIMIT ----------
  if (typeof takeProfit === "number" && takeProfit > 0) {

    const tpPayload = {
      category: "linear",
      symbol,
      side: "Sell",
      orderType: "Limit",
      qty: qty.toString(),
      price: takeProfit.toString(),
      reduceOnly: true,
      timeInForce: "GoodTillCancel"
    };

    const tpResult = await privateRequest(
      "POST",
      "/v5/order/create",
      tpPayload
    );

    console.log("🎯 Take Profit LIMIT placed:", tpResult.result);
  }

  return orderResult.result;
}

module.exports = {
  openIsolatedLongMarket,
};