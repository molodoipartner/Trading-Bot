const fs = require("fs");
const https = require("https");
const path = require("path");

/**
 * Скачивает Crypto Fear & Greed Index за последние N дней
 * Используется публичный API alternative.me (без API ключей)
 *
 * @param {number} days - количество дней (макс ~365)
 * @param {string} outputFile - путь к JSON файлу
 */
function downloadFearGreedIndex(days = 380, outputFile = "news/result/fear_greed_index.json") {
    const limit = Math.min(380, Math.max(1, days));
    const url = `https://api.alternative.me/fng/?limit=${limit}`;

    fs.mkdirSync(path.dirname(outputFile), { recursive: true });

    https.get(url, (res) => {
        let raw = "";

        res.on("data", chunk => raw += chunk);

        res.on("end", () => {
            try {
                const parsed = JSON.parse(raw);

                if (!parsed || !parsed.data) {
                    console.error("Unexpected response:", parsed);
                    return;
                }

                const result = parsed.data.map(item => ({
                    time: new Date(Number(item.timestamp) * 1000).toISOString(),
                    fearGreedIndex: Number(item.value),
                    classification: item.value_classification
                }));

                // Сортировка по времени (от старых к новым)
                result.sort((a, b) => new Date(a.time) - new Date(b.time));

                fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
                console.log(`✔ Fear & Greed Index (${limit} days) saved to: ${outputFile}`);

            } catch (err) {
                console.error("JSON parse error:", err);
            }
        });

    }).on("error", (err) => {
        console.error("Network error:", err);
    });
}

module.exports = downloadFearGreedIndex;
