const { publicRequest } = require("./client");

/**
 * Получает volatility score по последним закрытым свечам (как в бэктесте)
 */
async function getVolatilityScoreETH(lookback) {
  console.log("Fetching volatility score for ETH...");
  const maxP = 2;
  // нужно lookback + 2:
  // +1 для текущей (её уберём)
  // +1 потому что в оригинале используется (lookback + 1)
  const limit = lookback + 2;

  const res = await publicRequest("/v5/market/kline", {
    category: "linear",
    symbol: "ETHUSDT",
    interval: "5",
    limit,
  });

  if (!res || !res.result || !Array.isArray(res.result.list)) {
    throw new Error("Invalid Bybit response");
  }

  // Bybit → новые → старые → разворачиваем
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

  if (candles.length < lookback + 1) {
    throw new Error("Not enough candles");
  }

  // ❌ убираем текущую формирующуюся свечу
  const slice = candles.slice(0, -1);

  if (slice.length < lookback + 1) {
    throw new Error("Not enough closed candles");
  }

  if (slice.length === 0) return null;

  let totalVol = 0;

  for (const c of slice) {
    totalVol += ((c.high - c.low) / c.open) * 100;
  }

  const avgVol = totalVol / slice.length;

  const score = Math.min(avgVol / maxP, 1);
    const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });
    };
    
    return {
    score,
    avgVol,
    candlesUsed: slice.length,
    fromTime: formatTime(slice[0].time),
    toTime: formatTime(slice[slice.length - 1].time),
    };
}

module.exports = {
  getVolatilityScoreETH,
};