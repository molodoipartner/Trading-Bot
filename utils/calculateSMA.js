// utils/calculateSMA.js

function calculateSMA(data, period) {
  const smaArray = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      smaArray.push(null); // Недостаточно данных
      continue;
    }

    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += parseFloat(data[j].close);
    }

    const sma = sum / period;
    smaArray.push(parseFloat(sma.toFixed(5)));
  }

  return smaArray;
}

module.exports = calculateSMA;
