const { spawn } = require("child_process");

function runMT5() {
    return new Promise((resolve, reject) => {
        const py = spawn("python", ["mt5.py"], {
            cwd: __dirname,
            shell: true
        });

        let out = "";
        let err = "";

        py.stdout.on("data", d => out += d.toString());
        py.stderr.on("data", d => err += d.toString());

        py.on("close", code => {
            if (code !== 0) {
                reject(err || `Python exited with code ${code}`);
            } else {
                resolve(out.trim());
            }
        });
    });
}
/*
(async () => {
    try {
        const result = await runMT5();
        console.log(result);
    } catch (e) {
        console.error("Error:", e);
    }
})();
*/
//require('./runpy.js');




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


async function runAll() { 
  //generateSMA(sma1);
  //generateSMA(sma2); 
  // generateSMA(sma3);

  await new Promise(resolve => setTimeout(resolve, 1000));
  const startTimegenerate = new Date("2024-01-04 00:00:00");
  const endTimegenerate = new Date("2026-01-08 00:00:00");
  const volumes = expo(500, 1.2, 1); // base = 500, коэффициент = 1.3
  const addPercents = expo(0.01, 1.55, 3.7);

  /* 
  const volumes = expo(500, 1.2, 1); // base = 500, коэффициент = 1.3
  const addPercents = expo(0.01, 1.5, 3.5);
   */
  const [
    VOLUME1,
    VOLUME2,
    VOLUME3,
    VOLUME4,
    VOLUME5,
  ] = volumes;
  const volumessum = (VOLUME1 + VOLUME2 + VOLUME3 + VOLUME4 + VOLUME5)
  const [
    ADD_PERCENT,
    THIRD_ADD_PERCENT,
    FOURTH_ADD_PERCENT,
    FIFTH_ADD_PERCENT
  ] = addPercents;
  const MIN_DROP_PERCENT2 =  0.5;
  const MAX_DROP_PERCENT2 =  1.8;
  const LOOKBACK_HOURS2 = 2;
  const takeprofit = 0.01;
  const config = {
    START_BALANCE: 0, 
    SPREAD: 3,
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
    LOOKBACK_HOURS: LOOKBACK_HOURS2,
    MIN_DROP_PERCENT1: MIN_DROP_PERCENT2,
    MAX_DROP_PERCENT1: MAX_DROP_PERCENT2,
    volumessum: volumessum,
    //TP_PIPS: 110,
    //SL_PIPS: 50,
    //ALLOWED_HOURS: [17], 
    //smaPath1: `./backtest/indicator/sma${sma1}.csv`,
    //smaPath2: `./backtest/indicator/sma${sma2}.csv`, 
    //smaPath3: `./backtest/indicator/sma${sma3}.csv`,
   //ALLOWED_PHASES: ["BULL","BEAR"]
   //ALLOWED_PHASES: ["BULL"]
  };
  console.log(`\n^^^^^^^^^^^^^^^^^^^^\n${startTimegenerate.toISOString().split('T')[0]} ${endTimegenerate.toISOString().split('T')[0]}\nVolumes:${volumes}\nSum: ${volumessum}\nTake: ${takeprofit}\nPercents: ${addPercents}\n${LOOKBACK_HOURS2} hours Drop Percents: min ${MIN_DROP_PERCENT2}, max ${MAX_DROP_PERCENT2}\n^^^^^^^^^^^^^^^^^^^^\n`)
 generateTrades(startTimegenerate, endTimegenerate, config); await new Promise(resolve => setTimeout(resolve, 4000)); await runpyVisual();
} 
//runAll(); 


setTimeout(() => {   
  const startTime = "2024-01-03 00:00:00";  
  const endTime = "2027-05-11 00:00:00"; 
  const datapath = "./backtest/ETHUSDT_5m.csv"; 
  const runGeneration = require('./visualization/generation.js');
  runGeneration(startTime, endTime, datapath, sma1, sma2, sma3);
}, 7000);  

