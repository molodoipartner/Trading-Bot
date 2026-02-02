const { publicRequest } = require("./client");

/**
 * ETH — движение цены
 * ⚠️ ЛОГИКА 1-в-1 как в бэктесте:
 * - 5m свечи
 * - берём 2 последние ЗАКРЫТЫЕ свечи
 * - сравнение: open первой → low второй
 */
async function getLastTwoCandlesMoveETH() {
  console.log("Fetching last 2 closed candles move for ETH...");

  const res = await publicRequest("/v5/market/kline", {
    category: "linear",
    symbol: "ETHUSDT",
    interval: "5",
    limit: 4, // 2 закрытые + 1 текущая
  });

  if (
    !res ||
    !res.result ||
    !Array.isArray(res.result.list)
  ) {
    throw new Error("Invalid Bybit response");
  }

  // Bybit возвращает свечи от новой к старой → разворачиваем
  const candles = res.result.list
    .slice()
    .reverse()
    .map(c => ({
      time: Number(c[0]),
      open: Number(c[1]),
      high: Number(c[2]),
      low: Number(c[3]),
      close: Number(c[4]),
    }));

  console.log("Processed candles:", candles);

  if (candles.length < 3) {
    throw new Error("Not enough candles");
  }

  // ❌ убираем текущую формирующуюся свечу
  const closedCandles = candles.slice(0, -1);
  // ✅ берём 2 последние закрытые
  const startCandle  = closedCandles[0];
  const finishCandle = closedCandles[1];

  if (!startCandle || !finishCandle) {
    throw new Error("Closed candles not found");
  }

  const startPrice = startCandle.open;
  const finishPrice = finishCandle.low;
  const endPrice = closedCandles[2].close;

  const percentChange =
    ((startPrice - finishPrice) / startPrice) * 100;

  return {
    startPrice,
    finishPrice,
    endPrice,
    percentChange,
    startTime: startCandle.time,
    finishTime: finishCandle.time,
  };
}

module.exports = {
  getLastTwoCandlesMoveETH,
};
