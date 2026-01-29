const fs = require("fs");
const https = require("https");

function fetchKlines(symbol, interval, limit, start, end) {
    return new Promise((resolve, reject) => {
        let url = `https://api.bybit.com/v5/market/kline?category=linear&symbol=${symbol}&interval=${interval}&limit=${limit}`;
        if (start) url += `&start=${start}`;
        if (end) url += `&end=${end}`;

        https.get(url, (res) => {
            let data = "";
            res.on("data", c => data += c);
            res.on("end", () => {
                try {
                    resolve(JSON.parse(data).result.list || []);
                } catch (e) {
                    reject(e);
                }
            });
        }).on("error", reject);
    });
}

function rangeSteps(start, end, step) {
    const arr = [];
    for (let t = start; t > end; t -= step) {
        arr.push([t - step + 1, t]);
    }
    return arr;
}

async function main() {
    const symbol = "ETHUSDT";
    const intervalMinutes = 5;

    const now = Date.now();
    const twoYearsAgo = now - 1000 * 60 * 60 * 24 * 365 * 3;

    const minutes = (1000 * 60 * intervalMinutes);
    const candlesPerChunk = 1000;
    const chunkMs = candlesPerChunk * minutes; // интервал 1000 свечей

    const chunks = rangeSteps(now, twoYearsAgo, chunkMs);

    console.log("Chunks:", chunks.length);

    const concurrency = 8; // Параллельность
    let all = [];

    async function worker(chunkList) {
        for (const [start, end] of chunkList) {
            const data = await fetchKlines(symbol, intervalMinutes, 1000, start, end);
            all.push(...data);
            console.log("Got", data.length, "candles. Total:", all.length);
        }
    }

    // Разбиваем задачи на 8 потоков
    const chunkSize = Math.ceil(chunks.length / concurrency);
    const workers = [];

    for (let i = 0; i < concurrency; i++) {
        workers.push(worker(chunks.slice(i * chunkSize, (i + 1) * chunkSize)));
    }

    await Promise.all(workers);

    // Удаляем дубликаты и сортируем по времени
    const map = new Map();
    for (const k of all) map.set(k[0], k);
    const sorted = [...map.values()].sort((a,b) => a[0] - b[0]);

    // Генерация CSV
    let csv = "time,open,high,low,close,tick_volume,spread,real_volume\n";
    for (const k of sorted) {
        const [t, open, high, low, close] = k;
        const date = new Date(Number(t)).toISOString().replace("T"," ").slice(0,19);
        csv += `${date},${open},${high},${low},${close},0,0,0\n`;
    }

    fs.writeFileSync("backtest/ETHUSDT_5m.csv", csv);
    console.log("Saved", sorted.length, "candles.");
}

main();

/*
// runpy.js
const { execSync } = require("child_process");

// Если хочешь параметр — можно менять здесь:
const symbol = "EURUSD";

try {
  execSync(`python export_mt5.py ${symbol}`, { stdio: "inherit" });
} catch (err) {
  console.error("❌ Ошибка при запуске Python:", err.message);
}



/*

const { PythonShell } = require('python-shell');

PythonShell.run('mt5.py', null, function (err, results) {

  console.log("=== PYTHON OUTPUT START ===");
  console.log(results.join('\n'));
  console.log("=== PYTHON OUTPUT END ===");

  if (err) {
    console.error("Ошибка при запуске Python:", err);
    return;
  }

  try {
    const output = JSON.parse(results.join(''));
    if (output.status === 'ok') {
      console.log("✅ Данные успешно записаны в файл:", output.file);
    } else {
      console.error("⚠️ Ошибка в Python-скрипте:", output.error);
    }
  } catch (e) {
    console.error("❌ Не удалось распарсить ответ от Python:", results);
  }
});


*/