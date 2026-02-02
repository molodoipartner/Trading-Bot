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
    MIN_DROP_PERCENT1,
    MAX_DROP_PERCENT1,
    volumessum
  } = config;

  const trades = [];
  const usedDates = new Set();
  
  let nextAllowedEntryTime = null;
  const getNextHourTimestamp = (timeString) => {
    const date = new Date(timeString.replace(" ", "T") + "Z");

    date.setMinutes(0, 0, 0);
    date.setHours(date.getHours() + 1);

    return date.toISOString().slice(0, 16).replace("T", " ");
  };



  
  const isPriceChangeInRange = (candles, currentIndex) => {
    if (currentIndex < LOOKBACK_HOURS + 1) return false;

    const minPercent = MIN_DROP_PERCENT1;
    const maxPercent = MAX_DROP_PERCENT1;

    if (minPercent === 0 && maxPercent === 0) return true;

    const fromIndex = currentIndex - LOOKBACK_HOURS - 1;
    const toIndex = currentIndex - 1;

    const slice = candles.slice(fromIndex, toIndex);

    const startCandle = slice[0];
    const finishCandle = slice[1];

    const changePercent =
      ((startCandle.open - finishCandle.low) / startCandle.open) * 100;

    console.log(
      `📉 Диапазон: ${startCandle.open} → ${finishCandle.low} | ` +
      `Падение: ${changePercent.toFixed(2)}%`
    );

    const absMin = Math.abs(minPercent);
    const absMax = Math.abs(maxPercent);

    return changePercent >= absMin && changePercent <= absMax;
  };


/* 


const isPriceChangeInRange = (candles, signalIndex) => {
  const minPercent = MIN_DROP_PERCENT1;
  const maxPercent = MAX_DROP_PERCENT1;

  if (minPercent === 0 && maxPercent === 0) return true;

  const executionIndex = signalIndex - 1;
  if (executionIndex < 0) return false;

  const executionCandle = candles[executionIndex];

  const executionTime = new Date(
    executionCandle.time || executionCandle.timestamp
  ).getTime();

  const TWO_HOURS_MS = 2 * 5 * 60 * 1000;
  const targetTime = executionTime - TWO_HOURS_MS;

  // 🔍 ищем свечу ≈ 2 часа назад
  let startCandle = null;

  for (let i = executionIndex - 1; i >= 0; i--) {
    const t = new Date(
      candles[i].time || candles[i].timestamp
    ).getTime();

    if (t <= targetTime) {
      startCandle = candles[i];
      break;
    }
  }

  if (!startCandle) return false;

  // 🎯 ЦЕНЫ (ТОЛЬКО ЗАКРЫТЫЕ!)
  const startPrice = startCandle.open;        // open 2 часа назад
  const endPrice = executionCandle.close;     // close 17:25

  const changePercent =
    ((endPrice - startPrice) / startPrice) * 100;

  // 🧾 ЛОГ
  /*
  console.log("📊 Проверка диапазона (БЕЗ ЗАГЛЯДЫВАНИЯ)");
  console.log(
    "🕒 Старт:",
    startPrice,
    "| open:",
    startCandle.time
  );
  console.log(
    "🕔 Конец:",
    endPrice,
    "| close:",
    executionCandle.time
  );
  console.log(
    "📐 Изменение:",
    changePercent.toFixed(2) + "%"
  );
  console.log("— — — — — — — — — — —");

  const absMin = Math.abs(minPercent);
  const absMax = Math.abs(maxPercent);

  return (
    Math.abs(changePercent) >= absMin &&
    Math.abs(changePercent) <= absMax
  );
};

*/



  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    const [datePart, timePart] = candle.time.split(" ");

    // === ФИЛЬТР ПО ДНЯМ НЕДЕЛИ ===
    const dateObj = new Date(candle.time);
    const day = dateObj.getDay();
    //if (day === 6) continue; // ❌ выходные 
    // 0 = воскресенье, 6 = суббота



    const [hh, mm] = timePart.split(":");
    if (mm !== "05" && mm !== "35") continue;
    if (hh === "02") continue;
    if (hh === "13") continue;
    if (hh === "14") continue;
    if (hh === "17") continue;
    if (hh === "18") continue;
    if (hh === "19") continue;
    if (hh === "20") continue;
    if (hh === "21") continue;
    if (hh === "22") continue;
    if (hh === "23") continue;





    

    if (nextAllowedEntryTime && candle.time < nextAllowedEntryTime) {
      continue;
    }

    if (!isPriceChangeInRange(candles, i)) {
      continue;
    }
;

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
    let exitTime = null;
    let exitIndex = null;
    let finalTakeProfit = null;
    let lastEntryCandleIndex = null;

    let exitReason = "TAKE";


    // ===== ПОИСК СОБЫТИЙ =====
    for (let j = i + 1; j < candles.length; j++) {
      const c = candles[j];

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
    nextAllowedEntryTime = getNextHourTimestamp(exitTime);

    i = exitIndex;

    const exitWithSpread = exitPrice - SPREAD / 2;

    const profit = (exit, entry, vol) =>
      exit * (vol / entry) - vol;

    trades.push({
      entryTime: entryTime1,
      entryPrice: entryPrice1,
      entryPriceWithSpread: entryWithSpread1,
      takeProfit: finalTakeProfit,
      exitTime,
      exitPrice,
      exitPriceWithSpread: exitWithSpread,
      direction: "LONG",
      phase: "GRID",
      result: exitReason,
      volume: VOLUME1,
      profitQuoted: profit(exitWithSpread, entryWithSpread1, VOLUME1),
      spreadUsed: SPREAD,
      positionNumber: 1,
      volumessum: volumessum
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
        volumessum: volumessum
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
        volumessum: volumessum
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
        volumessum: volumessum
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
        volumessum: volumessum
      });
  }

  return trades;
};

module.exports = {
  runMorningQuintupleLongStrategy,
};