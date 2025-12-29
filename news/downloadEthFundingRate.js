const fs = require("fs");
const https = require("https");
const path = require("path");

const BASE_URL = "https://fapi.binance.com/fapi/v1/fundingRate";

/**
 * Скачивает ETH funding rate за последний год
 */
async function downloadEthFundingRateYear(outputFile = "news/eth_funding_rate_year.json") {
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });

    const now = Date.now();
    const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;

    let allData = [];
    let startTime = oneYearAgo;

    while (startTime < now) {
        const url = `${BASE_URL}?symbol=ETHUSDT&startTime=${startTime}&limit=1000`;

        const data = await fetchJson(url);
        if (!data.length) break;

        allData.push(...data);

        // следующий запрос — после последней записи
        startTime = data[data.length - 1].fundingTime + 1;

        // защита от спама
        await sleep(300);
    }

    const result = allData.map(item => ({
        time: new Date(item.fundingTime).toISOString(),
        fundingRate: Number(item.fundingRate)
    }));

    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log(`✔ ETH Funding Rate (1Y) saved: ${result.length} records`);
}

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, res => {
            let raw = "";
            res.on("data", chunk => raw += chunk);
            res.on("end", () => {
                try {
                    resolve(JSON.parse(raw));
                } catch (e) {
                    reject(e);
                }
            });
        }).on("error", reject);
    });
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

module.exports = downloadEthFundingRateYear;
