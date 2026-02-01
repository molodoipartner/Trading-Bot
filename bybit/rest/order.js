const { privateRequest } = require("./client");

async function openIsolatedLongLimit({
  symbol,
  qty,
  price,
  leverage,
  takeProfit
}) {

  // ---------- SET LEVERAGE (SAFE, UTA OK) ----------
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

  // ❌ switch-isolated — УДАЛЯЕМ

  // ---------- PLACE ORDER ----------
  const res = await privateRequest("POST", "/v5/order/create", {
    category: "linear",
    symbol,
    side: "Buy",
    orderType: "Limit",
    takeProfit: takeProfit.toString(),
    qty: qty.toString(),
    price: price.toString(),
    timeInForce: "GTC",
    reduceOnly: false,
    closeOnTrigger: false,
  });

  return res.result;
}

module.exports = {
  openIsolatedLongLimit,
};
