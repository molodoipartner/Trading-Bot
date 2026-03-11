import MetaTrader5 as mt5
import pandas as pd
from datetime import datetime, timedelta
import os

# -------- НАСТРОЙКИ --------
SYMBOL = "XAUUSD"
TIMEFRAME = mt5.TIMEFRAME_M5

LOGIN = 104258312
SERVER = "MetaQuotes-Demo"
PASSWORD = "2hTdGj_i"

TERMINAL_PATH = r"C:\Program Files\MetaTrader 5\terminal64.exe"

DAYS_TOTAL = 365 * 4
CHUNK_DAYS = 30

OUTPUT_FILE = "backtest/XAUUSD_M5_4years.csv"


# -------- ПОДКЛЮЧЕНИЕ --------
if not mt5.initialize(
        path=TERMINAL_PATH,
        login=LOGIN,
        password=PASSWORD,
        server=SERVER):

    print("Ошибка подключения:", mt5.last_error())
    quit()

print("MT5 подключен")

# -------- ВЫБОР СИМВОЛА --------
if not mt5.symbol_select(SYMBOL, True):
    print("Ошибка выбора символа")
    mt5.shutdown()
    quit()

print("Символ выбран:", SYMBOL)


# -------- ДАТЫ --------
date_to = datetime.now()
date_from = date_to - timedelta(days=DAYS_TOTAL)

current_to = date_to
all_data = []

print("Начинаю загрузку данных...")


# -------- ЗАГРУЗКА ДАННЫХ --------
while current_to > date_from:

    current_from = max(
        current_to - timedelta(days=CHUNK_DAYS),
        date_from
    )

    rates = mt5.copy_rates_range(
        SYMBOL,
        TIMEFRAME,
        current_from,
        current_to
    )

    if rates is not None and len(rates) > 0:

        df = pd.DataFrame(rates)

        df["time"] = pd.to_datetime(
            df["time"],
            unit="s"
        )

        all_data.append(df)

        print(
            "Загружено:",
            len(df),
            "свечей",
            df.time.min(),
            "->",
            df.time.max()
        )

    else:
        print("Нет данных:", current_from, current_to)

    current_to = current_from


# -------- ОБЪЕДИНЕНИЕ --------
df = pd.concat(all_data)

df = df.drop_duplicates(subset="time")

df = df.sort_values("time")


# -------- СОХРАНЕНИЕ --------
df.to_csv(
    OUTPUT_FILE,
    index=False,
    columns=[
        "time",
        "open",
        "high",
        "low",
        "close",
        "tick_volume"
    ]
)

print("Файл сохранён:", OUTPUT_FILE)

mt5.shutdown()