import { exec } from "child_process";
import fs from "fs";

const symbol = "EURUSD";

exec(`python export_mt5.py ${symbol}`, (error, stdout, stderr) => {
  if (error) {
    console.error(`Ошибка запуска Python: ${error.message}`);
    return;
  }
  if (stderr) console.error(stderr);
  console.log(stdout);

  // Читаем CSV и выводим в консоль как JSON (если нужно)
  const data = fs.readFileSync(`${symbol}_M5.csv`, "utf-8");
  console.log("Пример данных:", data.split("\n").slice(0, 5).join("\n"));
});
