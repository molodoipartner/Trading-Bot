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
    orderType: "Market",
    takeProfit: takeProfit.toString(),
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
