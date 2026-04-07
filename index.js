//require('./runpy.js');
/*
const http = require("http");

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200);
    res.end("OK");
  } else {
    res.writeHead(404);
    res.end();
  }
}).listen(PORT, () => {
  console.log(`🌐 Health server listening on port ${PORT}`);
});
*/
require("dotenv").config();   // 🔥 ПЕРВАЯ СТРОКА



//require("./bybit/ws/node.js");
require("./bybit/startConnection.js");
//require("./nigger.js");
//require("./bybit/ws/check-sign.js");
//require('./bybit/bybitconnectiontest.js');



// Скачиваем за 5 месяцев (можно менять)
//downloadFearGreed(12);
//downloadFundingETH(12);
//download_fear();

//require('./runpyVisual.js');
//require('./backtest/smatest.js');
const generateSMA = require("./generateSMA.js");
const generateTrades = require('./generateTrades'); 
const runpyVisual = require('./runpyVisual.js');
const expo = require("./wiw/expo.js");

const sma1 = 1201;
const sma2 = 1682;
const sma3 = 1503;

const datapath = "./backtest/ETHUSDT_5m.csv";
//XAUUSD_M5_4years.csv
//ETHUSDT_5m.csv


async function runAll() { 
  //generateSMA(sma1);
  //generateSMA(sma2); 
  // generateSMA(sma3);

  await new Promise(resolve => setTimeout(resolve, 1000));
  const startTimegenerate = new Date("2022-03-22 00:00:00");
  const endTimegenerate = new Date("2026-03-24 22:45:00"); 
  //const startTimegenerate = new Date("2026-04-01 00:00:00");
  //const endTimegenerate = new Date("2027-01-30 16:35:00"); 


const volumes = expo(7000, 1.195, 1);
const addPercents = expo(0.01, 1.48, 4.22);
//0.116231 ,0.116091, 0.117135 0.115358, ,0.116118
//
//1.7265
/*

const volumes = expo(500, 1.195, 1);
const addPercents = expo(0.01, 1.48, 4.22);




const volumes = expo(500, 1.67, 1);
const addPercents = expo(0.02, 1.35, 3.8);

const volumes = expo(500, 1.61, 1);
const addPercents = expo(0.02, 1.41, 3.2);
Gold
const volumes = expo(190, 1.16, 1);
const addPercents = expo(0.01, 1.123, 18.9);

Eth
  
const volumes = expo(190, 1.142, 1);
const addPercents = expo(0.01, 1.523, 4.19);

const volumes = expo(190, 1.142, 1);
const addPercents = expo(0.01, 1.54, 4.02);

const volumes = expo(500, 1.142, 1);
const addPercents = expo(0.01, 1.523, 4.19);
const volumes = expo(500, 1.16, 1);
const addPercents = expo(0.01, 1.55, 3.9);
  deposit: deposit,
  expo: {
    volume: {
      growth: 1.16,
      scale: 1
    },
    percent: {
      growth: 1.55,
      scale: 3.9
    }
  },


*/
  /* 
   */
  const [
    VOLUME1,
    VOLUME2,
    VOLUME3,
    VOLUME4,
    VOLUME5,
  ] = volumes;
  //const VOLUME4 = 0;
  //const VOLUME5 = 0;
  const volumessum = (VOLUME1 + VOLUME2 + VOLUME3 + VOLUME4 + VOLUME5)
  const [
    ADD_PERCENT,
    THIRD_ADD_PERCENT,
    FOURTH_ADD_PERCENT,
    FIFTH_ADD_PERCENT
  ] = addPercents; 
  const MIN_DROP_PERCENT1 = -10;
  const MAX_DROP_PERCENT1 =  20;
  const MIN_DROP_PERCENT2 = 21;
  const MAX_DROP_PERCENT2 = 22;
//  const LOOKBACK_HOURS2 = 46;
  const LOOKBACK_HOURS2changePercent = 10;


  const LOOKBACK_HOURS2 = 95;
  const SWING_RANGE = 14;
  const SWING_RANGE2 = 7;
  const takeprofit = 0.0097;

  const volume_indexMIN = 0;
  const volume_indexMAX = 1;
  const volume_LOOKBACK = 6; 

  //const volume_indexMIN2 = 0.097;
    const volume_indexMIN2 = 0.098;
  //const volume_indexMIN2 = 0;
  const volume_indexMAX2 = 1;
  const volume_LOOKBACK2 = 14; 

/*
  const volume_LOOKBACK2 = 13; 
  const volume_indexMIN2 = 0.101;
  //0.2057

  const volume_LOOKBACK2 = 14; 
  const volume_indexMIN2 = 0.097;
  //0.2098
*/
    const volume_indexMIN3 = 0;
  const volume_indexMAX3 = 1;
  const volume_LOOKBACK3 = 8; 

  const config = {
    START_BALANCE: 0, 
    SPREAD: 0,
    VOLUME1,
    VOLUME2,
    VOLUME3,
    VOLUME4,
    VOLUME5,
    TP_PERCENT: takeprofit,   // +1%
    ADD_PERCENT,
    THIRD_ADD_PERCENT,  
    FOURTH_ADD_PERCENT,
    FIFTH_ADD_PERCENT,
    MIN_MINUTES_BETWEEN_FIRST_AND_THIRD: 0,
    LOOKBACK_HOURS: LOOKBACK_HOURS2,
    LOOKBACK_HOURS2changePercent,
    MIN_DROP_PERCENT10: MIN_DROP_PERCENT1,
    MAX_DROP_PERCENT10: MAX_DROP_PERCENT1,
    MIN_DROP_PERCENT20: MIN_DROP_PERCENT2,
    MAX_DROP_PERCENT20: MAX_DROP_PERCENT2,
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
    volumessum: volumessum,
    //Volumes: 500,675,911.25,1230.1875,1660.753125
  };
  console.log(`\n^^^^^^^^^^^^^^^^^^^^\n${startTimegenerate.toISOString().split('T')[0]} - ${endTimegenerate.toISOString().split('T')[0]}\nVolumes: V1=${VOLUME1}, V2=${VOLUME2}, V3=${VOLUME3}, V4=${VOLUME4}, V5=${VOLUME5}\nSum: ${volumessum}\nTake: ${takeprofit}\nPercents: ${addPercents}\nDrop Percents: min ${MIN_DROP_PERCENT2}, max ${MAX_DROP_PERCENT2}\n^^^^^^^^^^^^^^^^^^^^\n`)
 generateTrades(startTimegenerate, endTimegenerate, config, datapath); await new Promise(resolve => setTimeout(resolve, 4000)); await runpyVisual();
} 
//runAll(); 


setTimeout(() => {   
  const startTime = "2022-03-22 00:00:00"; 

  //const startTime = "2026-04-01 00:00:00"; 
    const endTime = "2027-01-31 00:35:00";
  //const endTime = "2026-03-25 20:45:00";

  const datapath2 = datapath; 
  const runGeneration = require('./visualization/generation.js');
  //runGeneration(startTime, endTime, datapath2, sma1, sma2, sma3);
}, 4000);  

/*

function calculateAveragePrice(initialVolume, multiplier, firstPrice, drops) {

  let totalVolume = 0;
  let weightedPriceSum = 0;

  let price = firstPrice;

  console.log("----- POSITIONS -----");

  drops.forEach((drop, i) => {

    if (i !== 0) {
      price = price * (1 - drop / 100);
    }

    const volume = initialVolume * Math.pow(multiplier, i);

    console.log(
      `Position ${i + 1} | drop=${drop}% | price=${price.toFixed(4)} | volume=${volume.toFixed(2)}`
    );

    totalVolume += volume;
    weightedPriceSum += price * volume;

  });

  const avgPrice = weightedPriceSum / totalVolume;

  console.log("---------------------");
  console.log("Total volume:", totalVolume.toFixed(2));
  console.log("Average price:", avgPrice);

  return avgPrice;
}
const initialVolume = 500;
const multiplier = 1.2;
const firstPrice = 3201.33;

const drops = [0, 0.01, 0.031914, 0.065288,0.116118];

calculateAveragePrice(
  initialVolume,
  multiplier,
  firstPrice,
  drops
);
*/




/*
const reverseExpo = require("./reverseSmoothExpo.js");

const percents = [
  0.01,
  0.0298,
  0.051778,
  0.076174,
  0.103253
];

reverseExpo(percents);
*/