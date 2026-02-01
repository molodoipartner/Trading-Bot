// bybit/rest/marketData.js

const { publicRequest } = require("./client");

/**
 * ETH — движение цены за последние 2 часа
 * 5m свечи → 2 часа = 24 свечи
 */
async function getLastTwoHoursMoveETH() {
  const res = await publicRequest("/v5/market/kline", {
    category: "linear",
    symbol: "ETHUSDT",
    interval: "5",
    limit: 2 * 12,
  });

  // Bybit возвращает свечи от новой к старой → разворачиваем
  const candles = res.result.list
    .slice()
    .reverse()
    .map(c => ({
      open: Number(c[1]),
      close: Number(c[4]),
    }));

  const firstOpen = candles[0].open;                     // самое первое открытие
  const lastClose = candles[candles.length - 1].close;  // самое последнее закрытие

  const percentChange = ((lastClose - firstOpen) / firstOpen) * 100;

  return {
    startPrice: firstOpen,
    endPrice: lastClose,
    percentChange,
  };
}

/**
 * ETH — движение цены за последние 24 часа
 * 5m свечи → 24 часа = 288 свечей
 */
async function getLast24HoursMoveETH() {
  const res = await publicRequest("/v5/market/kline", {
    category: "linear",
    symbol: "ETHUSDT",
    interval: "5",
    limit: 288,
  });

  // Bybit возвращает свечи от новой к старой → разворачиваем
  const candles = res.result.list
    .slice()
    .reverse()
    .map(c => ({
      open: Number(c[1]),
      close: Number(c[4]),
    }));

  const firstOpen = candles[0].open;
  const lastClose = candles[candles.length - 1].close;

  const percentChange = ((lastClose - firstOpen) / firstOpen) * 100;

  return {
    startPrice: firstOpen,
    endPrice: lastClose,
    percentChange,
  };
}

module.exports = {
  getLastTwoHoursMoveETH,
  getLast24HoursMoveETH,
};
