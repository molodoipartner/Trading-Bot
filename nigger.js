const fs = require("fs");

const inputFile = "./backtest/XAU_5m_data.csv";
const outputFile = "./backtest/XAU_5m.csv";

const data = fs.readFileSync(inputFile, "utf8");

// правильное разделение строк
const lines = data.trim().split(/\r?\n/);

// пропускаем заголовок
const rows = lines.slice(1);

let result = [];
result.push("time,open,high,low,close,tick_volume,spread,real_volume");

for (const line of rows) {
    if (!line.trim()) continue;

    const parts = line.split(";");

    // проверка что строка нормальная
    if (parts.length < 6) continue;

    let [date, open, high, low, close, volume] = parts;

    const formattedDate = date.replace(/\./g, "-") + ":00";

    result.push(
        `${formattedDate},${open},${high},${low},${close},${volume},0,0`
    );
}

fs.writeFileSync(outputFile, result.join("\n"));

console.log("Готово ✅");