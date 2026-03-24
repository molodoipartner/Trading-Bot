const { publicRequest } = require("./client");

// ⚠️ те же параметры что и в бэктесте

// 🔧 формат времени (как ты просил)
const formatTime = (timestamp) => {
  const d = new Date(timestamp);
  const pad = (n) => String(n).padStart(2, "0");

  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

async function getLiquiditySweepETH(LOOKBACK_HOURS, SWING_RANGE, SWING_RANGE2) {
  console.log("Fetching liquidity sweep for ETH...");

  const limit = LOOKBACK_HOURS + 1;

  const res = await publicRequest("/v5/market/kline", {
    category: "linear",
    symbol: "ETHUSDT",
    interval: "5",
    limit,
  });

  if (!res || !res.result || !Array.isArray(res.result.list)) {
    throw new Error("Invalid Bybit response");
  }

  // 🔄 разворачиваем
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

  // ❌ убираем текущую свечу
  const slice = candles.slice(0, -1);


  const startCandle = slice[0];
  const finishCandle = slice[slice.length - 1];

  if (!startCandle || !finishCandle) {
    return { canbeopened: false, liquidityLevel: null };
  }

  let lowestLow = Infinity;
  let lowestLowCandle = null;
  let foundValidLow = false;

  for (let j = SWING_RANGE; j < slice.length - 2 - SWING_RANGE2; j++) {
    const candidate = slice[j];
    const candidateLow = candidate.low;

    let isValid = true;

    // LEFT
    for (let k = 1; k <= SWING_RANGE; k++) {
      if (slice[j - k].low <= candidateLow) {
        isValid = false;
        break;
      }
    }

    // RIGHT
    if (isValid) {
      for (let k = 1; k <= SWING_RANGE2; k++) {
        if (slice[j + k].low <= candidateLow) {
          isValid = false;
          break;
        }
      }
    }

    // NOT BROKEN LATER
    if (isValid) {
      for (let k = j + 1; k < slice.length - 1; k++) {
        if (slice[k].low <= candidateLow) {
          isValid = false;
          break;
        }
      }
    }

    if (isValid) {
      foundValidLow = true;

      if (candidateLow < lowestLow) {
        lowestLow = candidateLow;
        lowestLowCandle = candidate;
      }
    }
  }
  // 🔹 RANGE
  let rangeLow = Infinity;
  let rangeHigh = -Infinity;

  for (let i = 0; i < slice.length; i++) {
    if (slice[i].low < rangeLow) rangeLow = slice[i].low;
    if (slice[i].high > rangeHigh) rangeHigh = slice[i].high;
  }

  const range = {
    fromTime: slice[0].time,
    toTime: slice[slice.length - 1].time,
    fromTimeReadable: formatTime(slice[0].time),
    toTimeReadable: formatTime(slice[slice.length - 1].time),
    low: rangeLow,
    high: rangeHigh,
  };
  
  if (!foundValidLow || !lowestLowCandle) {
    return { canbeopened: false, liquidityLevel: null, range, message: "No Valid Low found" };
  }

  const currentCandle = slice[slice.length - 1];

  const isSweep = currentCandle.low < lowestLow;
  const isReclaim = currentCandle.close > lowestLow;

  const canbeopened = isSweep && isReclaim;

  const liquidityLevel = {
    price: lowestLow,
    time: lowestLowCandle.time,
    timeReadable: formatTime(lowestLowCandle.time),
  };


  const endPrice = finishCandle.close;
  return {
    canbeopened,
    liquidityLevel,
    range,
    endPrice,
  };
}

module.exports = {
  getLiquiditySweepETH,
};