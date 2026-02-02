const { privateRequest } = require("./client");

async function openIsolatedLongMarket({
  symbol,
  qty,
  leverage,
  takeProfit,
}) {
  // SET LEVERAGE
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

  // BUILD ORDER (NO PRICE)
  const orderPayload = {
    category: "linear",
    symbol,
    side: "Buy",
    orderType: "Market",
    qty: qty.toString(),
    reduceOnly: false,
    closeOnTrigger: false,
  };

  if (typeof takeProfit === "number" && takeProfit > 0) {
    orderPayload.takeProfit = takeProfit.toString();
    orderPayload.tpTriggerBy = "LastPrice";
  }

  return (
    await privateRequest("POST", "/v5/order/create", orderPayload)
  ).result;
}

module.exports = {
  openIsolatedLongMarket,
};
