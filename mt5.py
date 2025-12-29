import MetaTrader5 as mt5
import pandas as pd
from datetime import datetime, timedelta
import os
import sys

# ---------- CONFIG ----------
SYMBOL = "XAUUSD"
TIMEFRAME = mt5.TIMEFRAME_M5
OUT_DIR = "backtest"
FILE = "XAUUSD_5m.csv"

DAYS_TOTAL = 730      # 2 года
CHUNK_DAYS = 30       # грузим по 30 дней

# ---------- INIT ----------
if not mt5.initialize():
    print("MT5 init failed:", mt5.last_error())
    sys.exit(1)

# ---------- ACCOUNT ----------
if mt5.account_info() is None:
    print("No account connected")
    mt5.shutdown()
    sys.exit(1)

mt5.symbol_select(SYMBOL, True)

# ---------- DATE RANGE ----------
date_to = datetime.now() + timedelta(hours=2)
date_from = date_to - timedelta(days=DAYS_TOTAL)

all_chunks = []
current_to = date_to

# ---------- LOAD IN CHUNKS ----------
while current_to > date_from:
    current_from = max(current_to - timedelta(days=CHUNK_DAYS), date_from)

    rates = mt5.copy_rates_range(
        SYMBOL,
        TIMEFRAME,
        current_from,
        current_to
    )

    if rates is not None and len(rates) > 0:
        df = pd.DataFrame(rates)
        df["time"] = pd.to_datetime(df["time"], unit="s")
        all_chunks.append(df)

        print(
            f"Loaded {len(df)} bars "
            f"{df.time.min()} {df.time.max()}"
        )
    else:
        print(f"No data {current_from} {current_to}")

    current_to = current_from

# ---------- MERGE ----------
if not all_chunks:
    print("No data loaded at all")
    mt5.shutdown()
    sys.exit(1)

df = pd.concat(all_chunks)
df = df.drop_duplicates(subset="time")
df = df.sort_values("time")

# ---------- FILTER EXACT RANGE ----------
df = df[df["time"] >= date_from]

# ---------- SAVE ----------
os.makedirs(OUT_DIR, exist_ok=True)
path = os.path.join(OUT_DIR, FILE)

df.to_csv(
    path,
    index=False,
    date_format="%Y-%m-%d %H:%M:%S",
    columns=[
        "time",
        "open",
        "high",
        "low",
        "close",
        "tick_volume",
        "spread",
        "real_volume",
    ]
)

mt5.shutdown()

print(
    f"Saved {len(df)} M5 bars "
    f"from {df.time.min()} to {df.time.max()}"
)
