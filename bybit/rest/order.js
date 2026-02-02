const { privateRequest } = require("./client");

async function openIsolatedLongLimit({
  symbol,
  qty,
  price,
  leverage,
  takeProfit
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

  // BUILD ORDER
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

  return (
    await privateRequest("POST", "/v5/order/create", orderPayload)
  ).result;
}

module.exports = {
  openIsolatedLongLimit,
};
