/**
 * Morning Quintuple Long Strategy (NO STOPS)
 * - Вход каждый день в 17:00
 * - LONG
 * - 1–5 позиции с индивидуальными объёмами
 * - Усреднение
 * - Закрытие ТОЛЬКО по TP от среднего
 * - Новые сделки запрещены пока старая не закрыта
 */

const runMorningQuintupleLongStrategy = async (candles, config) => {
  const {
    SPREAD,
    VOLUME1, 
    VOLUME2,
    VOLUME3,
    VOLUME4,
    VOLUME5,
    TP_PERCENT,
    ADD_PERCENT,
    THIRD_ADD_PERCENT,
    FOURTH_ADD_PERCENT,
    FIFTH_ADD_PERCENT,
    MIN_MINUTES_BETWEEN_FIRST_AND_THIRD,
    LOOKBACK_HOURS,
    MIN_DROP_PERCENT10,
    MAX_DROP_PERCENT10,
    MIN_DROP_PERCENT20,
    MAX_DROP_PERCENT20,
    volume_indexMIN,
    volume_indexMAX,
    volume_LOOKBACK,
    volume_indexMIN2,
    volume_indexMAX2,
    volume_LOOKBACK2,
    volume_indexMIN3,
    volume_indexMAX3,
    volume_LOOKBACK3,
    SWING_RANGE,
    SWING_RANGE2,
    volumessum
  } = config;

  const trades = [];
  const usedDates = new Set();
  
  let isInPosition = false;
  const getNextHourTimestamp = (timeString) => {
    const date = new Date(timeString.replace(" ", "T") + "Z");

    date.setMinutes(0, 0, 0);
    date.setHours(date.getHours() + 1);

    return date.toISOString().slice(0, 16).replace("T", " ");
  };



  
const isPriceChangeInRange = (candles, currentIndex) => {

  // Проверяем что свечей достаточно для lookback
  if (currentIndex < LOOKBACK_HOURS + 1) {
    return { inRange: false, changePercent: null };
  }

  // Первая зона процентов
  const minPercent1 = MIN_DROP_PERCENT10;
  const maxPercent1 = MAX_DROP_PERCENT10;

  // Вторая зона процентов (новая)
  const minPercent2 = MIN_DROP_PERCENT20;
  const maxPercent2 = MAX_DROP_PERCENT20;

  // Если обе зоны отключены
  if (
    minPercent1 === 0 && maxPercent1 === 0 &&
    minPercent2 === 0 && maxPercent2 === 0
  ) {
    return { inRange: true, changePercent: 0 };
  }

  // Определяем диапазон свечей для анализа
  const fromIndex = currentIndex - LOOKBACK_HOURS - 1;
  const toIndex = currentIndex;
  //const toIndex = currentIndex;

  const slice = candles.slice(fromIndex, toIndex);

  const startCandle = slice[0];
  const finishCandle = slice[slice.length - 2];

  // Если свечей недостаточно
  if (!startCandle || !finishCandle) {
    console.warn("⚠️ Недостаточно свечей для расчёта");
    return { inRange: false, changePercent: null };
  }

  // Расчёт процента изменения
  const changePercent =
    ((startCandle.open - finishCandle.low) / startCandle.open) * 100;

/*
  slice.forEach((candle, i) => {
    console.log(
      `[${fromIndex + i}] ${new Date(candle.time).toLocaleString()} | ` +
      `O:${candle.open} H:${candle.high} L:${candle.low} C:${candle.close}`
    );
  });

  console.log(
    `📉 Проверка движения:\n` +
    `   🟢 Start candle: ${new Date(startCandle.time).toLocaleString()} | open = ${startCandle.open}\n` +
    `   🔴 Finish candle: ${new Date(finishCandle.time).toLocaleString()} | low = ${finishCandle.low}\n` +
    `   📊 Падение: ${changePercent.toFixed(2)}%`
  );

console.log(`📊 Падение: ${changePercent.toFixed(2)}% ${new Date(startCandle.time).toLocaleString()}\n`)
*/

  // Проверяем попадание в первую зону
  const inRange1 =
    changePercent >= minPercent1 && changePercent <= maxPercent1;

  // Проверяем попадание во вторую зону
  const inRange2 =
    changePercent >= minPercent2 && changePercent <= maxPercent2;

  // Если попало хотя бы в одну из зон
  const inRange = inRange1 || inRange2;

  return {
    inRange,
    changePercent
  };
};

const isHaveWeCollectedLiquidity = (candles, currentIndex) => {

  if (currentIndex < LOOKBACK_HOURS + Math.max(SWING_RANGE, SWING_RANGE2) + 2) {
    return { canbeopened: false, liquidityLevel: null, imbalanceLevel: null };
  }

  const fromIndex = currentIndex - LOOKBACK_HOURS;
  const toIndex = currentIndex;

  const slice = candles.slice(fromIndex, toIndex);

  const startCandle = slice[0];
  const finishCandle = slice[slice.length - 1];

  if (!startCandle || !finishCandle) {
    return { canbeopened: false, liquidityLevel: null, imbalanceLevel: null };
  }

  // 🔹 1. ЛИКВИДНОСТЬ
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
      for (let k = j + 1; k < slice.length - 2; k++) {
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

  if (!foundValidLow || !lowestLowCandle) {
    return { canbeopened: false, liquidityLevel: null, imbalanceLevel: null };
  }

  // 🔥 индекс ликвидности
  let liquidityIndex = -1;
  for (let i = 0; i < slice.length; i++) {
    if (slice[i].time === lowestLowCandle.time) {
      liquidityIndex = i;
      break;
    }
  }

  if (liquidityIndex === -1) {
    return { canbeopened: false, liquidityLevel: null, imbalanceLevel: null };
  }

  // 🔹 2. SWEEP
  let sweepIndex = -1;

  for (let i = liquidityIndex + 1; i < slice.length; i++) {
    const c = slice[i];

    if (c.low < lowestLow && c.close > lowestLow) {
      sweepIndex = i;
      break;
    }
  }

  if (sweepIndex === -1) {
    return { canbeopened: false, liquidityLevel: null, imbalanceLevel: null };
  }

  const sweepCandle = slice[sweepIndex];

// 🔹 3. IMBALANCE (ЧИСТЫЙ FVG БЕЗ ИМПУЛЬСА)
let imbalance = null;

for (let i = sweepIndex + 2; i < slice.length; i++) {

  const c1 = slice[i - 2];
  const c2 = slice[i - 1];
  const c3 = slice[i];

  // защита от undefined (на всякий случай)
  if (!c1 || !c2 || !c3) continue;

  // классический imbalance (FVG)
  if (c1.high < c3.low) {
    imbalance = {
      high: c3.low,
      low: c1.high,
      time: c3.time,
      timeReadable: new Date(c3.time).toLocaleString()
    };
    break;
  }
}
/*
  if (!imbalance) {

    return {
      canbeopened: false,
      liquidityLevel: {
        price: lowestLow,
        time: lowestLowCandle.time,
        timeReadable: new Date(lowestLowCandle.time).toLocaleString()
      },
      imbalanceLevel: null
    };
  }
*/
  // 🔹 4. RETEST
  const currentCandle = slice[slice.length - 1];

  //const isRetest = currentCandle.low <= imbalance.high;

  //const canbeopened = isRetest;
    const canbeopened = true;

  const liquidityLevel = {
    price: lowestLow,
    time: lowestLowCandle.time,
    timeReadable: new Date(lowestLowCandle.time).toLocaleString()
  };

  //const imbalanceLevel = imbalance;

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
    fromTimeReadable: new Date(slice[0].time).toLocaleString(),
    toTimeReadable: new Date(slice[slice.length - 1].time).toLocaleString(),
    low: rangeLow,
    high: rangeHigh
  };
const jd = false;
  if (canbeopened && jd) {
    console.log(`
==============================
🟢 STRUCTURE CHECK (CLEAN)

📉 LIQUIDITY:
level: ${liquidityLevel.price}
time: ${liquidityLevel.timeReadable}

💧 SWEEP:
time: ${new Date(sweepCandle.time).toLocaleString()}
low: ${sweepCandle.low}
close: ${sweepCandle.close}

🟡 IMBALANCE:
high: ${imbalanceLevel.high}
low:  ${imbalanceLevel.low}
time: ${imbalanceLevel.timeReadable}

📊 CURRENT:
time: ${new Date(currentCandle.time).toLocaleString()}
low: ${currentCandle.low}

🔁 RETEST:
${currentCandle.low} <= ${imbalance.high} → ${isRetest}

📦 RANGE:
low: ${range.low}
high: ${range.high}

✅ ENTRY: ${canbeopened}
==============================
    `);
  }

  return {
    canbeopened,
    liquidityLevel,
    //imbalanceLevel,
    range
  };
};

const getVolatilityScore = (candles, currentIndex, lookback, maxP) => {
  if (currentIndex < lookback + 1) return null;

  const fromIndex = currentIndex - lookback - 1;
  const toIndex = currentIndex; 

  const slice = candles.slice(fromIndex, toIndex);

  if (slice.length === 0) return null;

  const firstCandle = slice[0];
  const lastCandle = slice[slice.length - 1];

  // 🕒 текущая свеча (момент анализа)
  const currentCandle = candles[currentIndex];

  /*
  console.log("🧠 === VOLATILITY DEBUG ===");
  console.log(
    `📍 Анализ на индексе: ${currentIndex} | время: ${new Date(currentCandle.time).toLocaleString()}`
  );

  console.log(
    `📊 Диапазон индексов: [${fromIndex} → ${toIndex - 1}]`
  );

  console.log(
    `🟢 Первая свеча:\n` +
    `   индекс: ${fromIndex}\n` +
    `   время: ${new Date(firstCandle.time).toLocaleString()}\n` +
    `   O:${firstCandle.open} H:${firstCandle.high} L:${firstCandle.low} C:${firstCandle.close}`
  );

  console.log(
    `🔴 Последняя свеча:\n` +
    `   индекс: ${toIndex - 1}\n` +
    `   время: ${new Date(lastCandle.time).toLocaleString()}\n` +
    `   O:${lastCandle.open} H:${lastCandle.high} L:${lastCandle.low} C:${lastCandle.close}`
  );

  console.log(`📦 Кол-во свечей в анализе: ${slice.length}`);
*/

  let totalVol = 0;

  for (const c of slice) {
    totalVol += ((c.high - c.low) / c.open) * 100;
  }

  const avgVol = totalVol / slice.length;

  // 🎯 нормализация: до 1 растёт, выше — просто 1
  const score = Math.min(avgVol / maxP, 1);
  /*
  console.log(`📈 Avg Volatility: ${avgVol.toFixed(4)}%`);
  console.log(`🎯 Score: ${score.toFixed(4)}`);
  console.log("=====================================\n\n");
  */
  return score;
};




for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    const [datePart, timePart] = candle.time.split(" ");

    // === ФИЛЬТР ПО ДНЯМ НЕДЕЛИ ===
    const dateObj = new Date(candle.time);
    const day = dateObj.getDay();
    //if (day === 6) continue; // ❌ выходные 
    // 0 = воскресенье, 6 = суббота



    const [hh, mm] = timePart.split(":");
/*
    if (mm !== "05" && mm !== "35") continue;


    if (hh === "06") continue;
    if (hh === "13") continue;
    if (hh === "14") continue;
    if (hh === "17") continue;
    if (hh === "18") continue;
    if (hh === "19") continue;
    if (hh === "20") continue;
    if (hh === "21") continue;
    if (hh === "22") continue;
    if (hh === "23") continue;
*/

    if (mm !== "00" && mm !== "05" && mm !== "10" && mm !== "15" && mm !== "20" && mm !== "25"
      && mm !== "30" && mm !== "35" && mm !== "40" && mm !== "45" && mm !== "50" && mm !== "55") continue;



    if (isInPosition) {
      continue;
    }
      const maxP = 2;
      const volScore = getVolatilityScore(candles, i, volume_LOOKBACK, maxP);
      if (volScore === null) continue;
      if (volScore < volume_indexMIN || volScore > volume_indexMAX) {
        continue;
      }

      const volScore2 = getVolatilityScore(candles, i, volume_LOOKBACK2, maxP);
      if (volScore2 === null) continue;
      if (volScore2 < volume_indexMIN2 || volScore2 > volume_indexMAX2) {
        continue;
      }

      const volScore3 = getVolatilityScore(candles, i, volume_LOOKBACK3, maxP);
      if (volScore3 === null) continue;
      if (volScore3 < volume_indexMIN3 || volScore3 > volume_indexMAX3) {
        continue;
      }

/*
    const { inRange, changePercent } = isPriceChangeInRange(candles, i);

    if (!inRange) {
      continue;
    }
*/
const changePercent = 1;
    const { canbeopened, liquidityLevel, imbalanceLevel, range } = isHaveWeCollectedLiquidity(candles, i);

    if (!canbeopened) {
      continue;
    }


    usedDates.add(datePart);

    // ===== 1-Я ПОЗИЦИЯ =====
    const signalCandle = candles[i];      // 17:30
    const executionCandle = candles[i-1]; // 17:25 (уже закрыта)

    if (!executionCandle) continue;

    const entryTime1 = signalCandle.time;     // 17:30 — время решения
    const entryPrice1 = executionCandle.close; // ✅ close 17:25


    const entryWithSpread1 = entryPrice1 + SPREAD / 2;

    const addPrice2 = entryPrice1 * (1 - ADD_PERCENT);
    const tp1 = entryWithSpread1 * (1 + TP_PERCENT);

    let secondOpened = false;
    let thirdOpened = false;
    let fourthOpened = false;
    let fifthOpened = false;

    let entryPrice2, entryWithSpread2, entryTime2;
    let entryPrice3, entryWithSpread3, entryTime3;
    let entryPrice4, entryWithSpread4, entryTime4;
    let entryPrice5, entryWithSpread5, entryTime5;

    let exitPrice = null;
    let avgEntryPrice =  null;
    let exitTime = null;
    let exitIndex = null;
    let finalTakeProfit = null;
    let lastEntryCandleIndex = null;

    let exitReason = "TAKE";

    // === МИНИМАЛЬНЫЕ ЦЕНЫ ДЛЯ ПРОСАДКИ ===
    let minPrice1 = entryPrice1;
    let minPrice2 = null;
    let minPrice3 = null;
    let minPrice4 = null;
    let minPrice5 = null;
    let maxHighBeforeThird = entryPrice1;

    // === МИНИМУМ ВСЕЙ СДЕЛКИ ===
    let minPriceWholeTrade = entryPrice1;
    // ===== ПОИСК СОБЫТИЙ =====
    isInPosition = true;
    for (let j = i + 1; j < candles.length; j++) {
      const c = candles[j];

      // === ОБНОВЛЯЕМ МИНИМУМЫ ===
      if (c.low < minPrice1) minPrice1 = c.low;
      if (secondOpened && (minPrice2 === null || c.low < minPrice2)) minPrice2 = c.low;
      if (thirdOpened && (minPrice3 === null || c.low < minPrice3)) minPrice3 = c.low;
      if (fourthOpened && (minPrice4 === null || c.low < minPrice4)) minPrice4 = c.low;
      if (fifthOpened && (minPrice5 === null || c.low < minPrice5)) minPrice5 = c.low;
      // === ОБНОВЛЯЕМ МИНИМУМ ВСЕЙ СДЕЛКИ ===
      if (c.low < minPriceWholeTrade) minPriceWholeTrade = c.low;
      // === максимум до открытия 3 позиции ===
      if (!fifthOpened && c.high > maxHighBeforeThird) {
        maxHighBeforeThird = c.high;
      }

      // === TP ТОЛЬКО ПО 1-Й ===
      if (
        !secondOpened &&
        c.high >= tp1 &&
        (lastEntryCandleIndex === null || j > lastEntryCandleIndex)
      ) {
        exitPrice = tp1;
        exitTime = c.time;
        exitIndex = j;
        finalTakeProfit = tp1;
        break;
      }

      // === 2-Я ===
      if (!secondOpened && c.low <= addPrice2) {
        secondOpened = true;
        entryPrice2 = addPrice2;
        entryTime2 = c.time;
        entryWithSpread2 = entryPrice2 + SPREAD / 2;
        minPrice2 = entryPrice2;
        lastEntryCandleIndex = j;
      }

      if (secondOpened) {
        const addPrice3 = entryPrice2 * (1 - THIRD_ADD_PERCENT);

        // === 3-Я ===
        if (!thirdOpened && c.low <= addPrice3) {
          thirdOpened = true;
          entryPrice3 = addPrice3;
          entryTime3 = c.time;
          entryWithSpread3 = entryPrice3 + SPREAD / 2;
          minPrice3 = entryPrice3;
          lastEntryCandleIndex = j;
        }
        // === 4-Я ===
        if (thirdOpened) {
          const addPrice4 = entryPrice3 * (1 - FOURTH_ADD_PERCENT);

          if (!fourthOpened && c.low <= addPrice4) {
            fourthOpened = true;
            entryPrice4 = addPrice4;
            entryTime4 = c.time;
            entryWithSpread4 = entryPrice4 + SPREAD / 2;
            minPrice4 = entryPrice4;
            lastEntryCandleIndex = j;
          }
        }

        // === 5-Я ===    
        if (fourthOpened) {
          const addPrice5 = entryPrice4 * (1 - FIFTH_ADD_PERCENT);


          if (!fifthOpened && c.low <= addPrice5) {

            
            const t3 = new Date(entryTime4).getTime();
            const tNow = new Date(c.time).getTime();

            const minutesBetween3and4 = (tNow - t3) / (1000 * 60);

            if (
              minutesBetween3and4 > 0 &&
              minutesBetween3and4 < MIN_MINUTES_BETWEEN_FIRST_AND_THIRD
            ) {
              // ❌ СЛИШКОМ БЫСТРО → ЗАКРЫВАЕМ 1,2,3
              exitPrice = c.low;
              exitTime = c.time;
              exitIndex = j;
              finalTakeProfit = tp1;
              exitReason = "STOP";
              break;
            }



            fifthOpened = true;
            entryPrice5 = addPrice5;
            entryTime5 = c.time;
            entryWithSpread5 = entryPrice5 + SPREAD / 2;
            minPrice5 = entryPrice5;
            lastEntryCandleIndex = j;
          }
        }

        // ===== СРЕДНИЙ ВХОД =====
        const totalVolume =
          VOLUME1 +
          VOLUME2 +
          (thirdOpened ? VOLUME3 : 0) +
          (fourthOpened ? VOLUME4 : 0) +
          (fifthOpened ? VOLUME5 : 0);

        const avgEntry =
          (entryWithSpread1 * VOLUME1 +
            entryWithSpread2 * VOLUME2 +
            (thirdOpened ? entryWithSpread3 * VOLUME3 : 0) +
            (fourthOpened ? entryWithSpread4 * VOLUME4 : 0) +
            (fifthOpened ? entryWithSpread5 * VOLUME5 : 0)) /
          totalVolume;
        avgEntryPrice = avgEntry;
        const tpAvg = avgEntry * (1 + TP_PERCENT);

        if (
          c.high >= tpAvg &&
          (lastEntryCandleIndex === null || j > lastEntryCandleIndex)
        ) {
          exitPrice = tpAvg;
          exitTime = c.time;
          exitIndex = j;
          finalTakeProfit = tp1;
          break;
        }

      }
    }

    if (!exitTime) break;
    //nextAllowedEntryTime = getNextHourTimestamp(exitTime);
    isInPosition = false;
    i = exitIndex;

    const exitWithSpread = exitPrice - SPREAD / 2;

    const profit = (exit, entry, vol) =>
      exit * (vol / entry) - vol;

    const drawdownPercent = (entry, min) =>
      ((entry - min) / entry) * 100;

    const gridDrawdownPercent = (avg, min) =>
      ((avg - min) / avg) * 100;

    const upwardMovePercent = (entry, max) =>
      ((max - entry) / entry) * 100;
    const maxUpBeforeThird =
      thirdOpened
        ? upwardMovePercent(entryPrice1, maxHighBeforeThird)
        : null;


    const entryDate = new Date(entryTime1);
    const exitDate = new Date(exitTime);

    const diffMs = exitDate - entryDate;

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

    const tradeDuration =
      String(hours).padStart(2, "0") + ":" +
      String(minutes).padStart(2, "0") + ":" +
      String(seconds).padStart(2, "0");

    trades.push({
      entryTime: entryTime1,
      entryPrice: entryPrice1,
      entryPriceWithSpread: entryWithSpread1,
      takeProfit: finalTakeProfit,
      exitTime,
      tradeDuration: tradeDuration,
      exitPrice,
      exitPriceWithSpread: exitWithSpread,
      direction: "LONG",
      phase: "GRID",
      result: exitReason,
      volume: VOLUME1,
      profitQuoted: profit(exitWithSpread, entryWithSpread1, VOLUME1),
      spreadUsed: SPREAD,
      positionNumber: 1,
      volumessum: volumessum,
      avgEntryPrice: avgEntryPrice,
      maxDrawdownPercent: drawdownPercent(entryPrice1, minPrice1),
      maxUpBeforeThirdPercent: maxUpBeforeThird,
      //changePercent: changePercent,
      volumeindex: volScore,
      volumeindex2: volScore2,
      volumeindex3: volScore3,
      ...(fourthOpened && {
        gridDrawdownPercent: gridDrawdownPercent(avgEntryPrice, minPriceWholeTrade),
      }),
      liquidityLevel,
      //imbalanceLevel,
      range
    });

    if (secondOpened)
      trades.push({
        entryTime: entryTime2,
        entryPrice: entryPrice2,
        entryPriceWithSpread: entryWithSpread2,
        takeProfit: finalTakeProfit,
        exitTime,
        exitPrice,
        exitPriceWithSpread: exitWithSpread,
        direction: "LONG",
        phase: "GRID",
        result: exitReason,
        volume: VOLUME2,
        profitQuoted: profit(exitWithSpread, entryWithSpread2, VOLUME2),
        spreadUsed: SPREAD,
        positionNumber: 2,
        volumessum: volumessum,
        avgEntryPrice: avgEntryPrice,
        maxDrawdownPercent: drawdownPercent(entryPrice2, minPrice2),
        //changePercent: changePercent
      });

    if (thirdOpened)
      trades.push({
        entryTime: entryTime3,
        entryPrice: entryPrice3,
        entryPriceWithSpread: entryWithSpread3,
        takeProfit: finalTakeProfit,
        exitTime,
        exitPrice,
        exitPriceWithSpread: exitWithSpread,
        direction: "LONG",
        phase: "GRID",
        result: exitReason,
        volume: VOLUME3,
        profitQuoted: profit(exitWithSpread, entryWithSpread3, VOLUME3),
        spreadUsed: SPREAD,
        positionNumber: 3,
        volumessum: volumessum,
        avgEntryPrice: avgEntryPrice,
        maxDrawdownPercent: drawdownPercent(entryPrice3, minPrice3),
        //changePercent: changePercent
      });

    if (fourthOpened)
      trades.push({
        entryTime: entryTime4,
        entryPrice: entryPrice4,
        entryPriceWithSpread: entryWithSpread4,
        takeProfit: finalTakeProfit,
        exitTime,
        exitPrice,
        exitPriceWithSpread: exitWithSpread,
        direction: "LONG",
        phase: "GRID",
        result: exitReason,
        volume: VOLUME4,
        profitQuoted: profit(exitWithSpread, entryWithSpread4, VOLUME4),
        spreadUsed: SPREAD,
        positionNumber: 4,
        volumessum: volumessum,
        avgEntryPrice: avgEntryPrice,
        maxDrawdownPercent: drawdownPercent(entryPrice4, minPrice4),
        //changePercent: changePercent
      });

    if (fifthOpened)
      trades.push({
        entryTime: entryTime5,
        entryPrice: entryPrice5,
        entryPriceWithSpread: entryWithSpread5,
        takeProfit: finalTakeProfit,
        exitTime,
        exitPrice,
        exitPriceWithSpread: exitWithSpread,
        direction: "LONG",
        phase: "GRID",
        result: "TAKE",
        volume: VOLUME5,
        profitQuoted: profit(exitWithSpread, entryWithSpread5, VOLUME5),
        spreadUsed: SPREAD,
        positionNumber: 5,
        volumessum: volumessum,
        avgEntryPrice: avgEntryPrice,
        maxDrawdownPercent: drawdownPercent(entryPrice5, minPrice5),
        //changePercent: changePercent
      });
  }

  return trades;
};

module.exports = {
  runMorningQuintupleLongStrategy,
};