import json
import matplotlib.pyplot as plt
import os
import csv
import numpy as np
from scipy.stats import gaussian_kde
from datetime import datetime
from collections import defaultdict
from dateutil.parser import parse as parse_datetime
from matplotlib.patches import FancyBboxPatch
from matplotlib.lines import Line2D
# === Функция скользящего среднего ===
def moving_average(data, window_size=3):
    return np.convolve(data, np.ones(window_size) / window_size, mode="same")

# === Пути к JSON ===
file_path = "positions/trades.json"
stats_path = "positions/trade_stats.json"

# === Проверка наличия файлов ===
if not os.path.exists(file_path):
    raise FileNotFoundError("❌ Файл trades.json не найден.")

if not os.path.exists(stats_path):
    raise FileNotFoundError("❌ Файл trade_stats.json не найден.")

# === Загрузка данных ===
with open(file_path, "r", encoding="utf-8") as f:
    trades = json.load(f)

with open(stats_path, "r", encoding="utf-8") as f:
    stats = json.load(f)

# ======================================================
# === СООТНОШЕНИЕ totalProfitQuoted / volumessum ===
# ======================================================

total_profit = float(stats.get("totalProfitQuoted", 0))
trade_volume_sum = float(trades[0].get("volumessum", 0))

if trade_volume_sum != 0:
    profit_to_volume_ratio = total_profit / trade_volume_sum
    profit_to_volume_ratio_display = f"{profit_to_volume_ratio:.4f}"
else:
    profit_to_volume_ratio_display = "N/A"

print("total_profit:", total_profit)
print("trade_volume_sum:", trade_volume_sum)

# ======================================================
# === ПОДСЧЁТ positionNumber
# ======================================================

position_counts = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0
}

for trade in trades:

    pos = trade.get("positionNumber")

    if pos in position_counts:
        position_counts[pos] += 1


# === Создание визуальной панели ===
fig, ax = plt.subplots(figsize=(10, 8))
ax.axis("off")
fig.patch.set_facecolor("white")

plt.title(
    "Общая статистика торговли",
    fontsize=16,
    fontweight="bold",
    loc="left",
    pad=20
)

# ======================================================
# === СРЕДНЕЕ ВРЕМЯ В СДЕЛКЕ (ТОЛЬКО positionNumber = 1)
# ======================================================

durations_seconds = []

for trade in trades:

    if trade.get("positionNumber") != 1:
        continue

    entry_time = trade.get("entryTime")
    exit_time = trade.get("exitTime")

    if not entry_time or not exit_time:
        continue

    try:
        entry_dt = datetime.strptime(entry_time, "%Y-%m-%d %H:%M:%S")
        exit_dt = datetime.strptime(exit_time, "%Y-%m-%d %H:%M:%S")

        duration = (exit_dt - entry_dt).total_seconds()

        if duration > 0:
            durations_seconds.append(duration)

    except Exception as e:
        print(f"Ошибка расчёта времени сделки: {e}")

if durations_seconds:

    avg_seconds = sum(durations_seconds) / len(durations_seconds)

    hours = int(avg_seconds // 3600)
    minutes = int((avg_seconds % 3600) // 60)

    avg_trade_duration_display = f"{hours} ч {minutes} мин"

else:

    avg_trade_duration_display = "N/A"

# ======================================================
# === МАКСИМАЛЬНАЯ ПРОСАДКА ОТ AVG ENTRY
# ======================================================

max_avg_drawdown = None

for trade in trades:

    dd = trade.get("gridDrawdownPercent")

    if dd is None:
        continue

    try:
        dd = float(dd)

        if max_avg_drawdown is None or dd > max_avg_drawdown:
            max_avg_drawdown = dd

    except:
        continue

if max_avg_drawdown is not None:
    max_avg_drawdown_display = f"{max_avg_drawdown:.2f}%"
else:
    max_avg_drawdown_display = "N/A"

# ======================================================
# === ДОБАВЛЕНО: ЗАРАБОТОК В МЕСЯЦ
# ======================================================

if max_avg_drawdown is not None and trade_volume_sum != 0:

    monthly_earnings = (100 / max_avg_drawdown) * (profit_to_volume_ratio / 48)

    monthly_earnings_display = f"{monthly_earnings:.4f}"

else:

    monthly_earnings_display = "N/A"
    
# ======================================================
# === ТАБЛИЦА СТАТИСТИКИ
# ======================================================
# ======================================================
# === МАКСИМАЛЬНАЯ ПРОСАДКА ПО БАЛАНСУ (от 0)
# ======================================================



# --- сортируем сделки по времени выхода
trades_sorted = sorted(
    trades,
    key=lambda x: parse_datetime(x["exitTime"]) if x.get("exitTime") else datetime.min
)

balance = 0
peak = 0
max_drawdown = 0

for trade in trades_sorted:

    profit = float(trade.get("profitQuoted", 0))
    balance += profit

    # обновляем пик
    if balance > peak:
        peak = balance

    # считаем просадку от пика
    drawdown = peak - balance

    # обновляем максимум
    if drawdown > max_drawdown:
        max_drawdown = drawdown

# --- формат для вывода
max_dd_display = f"{max_drawdown:.2f}"

info_lines = [

    ("Всего дней в данных", stats["totalDaysInData"]),
    ("Всего сделок", stats["totalTrades"]),
    ("Профитных сделок", stats["profitableTrades"]),
    ("Убыточных сделок", stats["losingTrades"]),
    ("Win rate", f"{stats['winRate']}%"),
    ("Средняя прибыль", stats["averageProfitQuoted"]),
    ("Макс. прибыль", stats["maxProfitQuoted"]),
    ("Макс. убыток", stats["maxLossQuoted"]),
    ("Макс. просадка по балансу", max_dd_display),
    ("Ср. сделок в день", stats["averageTradesPerDay"]),
    ("LONG-сделок", stats["longTrades"]),
    ("SHORT-сделок", stats["shortTrades"]),
    ("Общий профит", total_profit),
    ("Объём сделки (volumessum)", trade_volume_sum),
    ("Профит / объём сделки", profit_to_volume_ratio_display),

    ("Среднее время в сделке (position 1)", avg_trade_duration_display),

    # === НОВЫЕ СТРОКИ ===
    ("Сделок positionNumber = 1", position_counts[1]),
    ("Сделок positionNumber = 2", position_counts[2]),
    ("Сделок positionNumber = 3", position_counts[3]),
    ("Сделок positionNumber = 4", position_counts[4]),
    ("Сделок positionNumber = 5", position_counts[5]),
    ("Макс. просадка от avgEntryPrice", max_avg_drawdown_display),

    # === ДОБАВЛЕНО ===
    ("Заработок в месяц", monthly_earnings_display),
]

# === Цвета и стили ===
label_color = "#333333"
value_color = "#0055A4"
row_height = 0.06

# === Отрисовка строк ===
for i, (label, value) in enumerate(info_lines):

    y = 0.95 - i * row_height

    box = FancyBboxPatch(
        (0.03, y - 0.03),
        0.94,
        0.05,
        boxstyle="round,pad=0.01",
        linewidth=1,
        edgecolor="#DDDDDD",
        facecolor="#F7F7F7"
    )

    ax.add_patch(box)

    ax.text(
        0.05,
        y,
        f"{label}:",
        fontsize=12,
        ha="left",
        va="top",
        color=label_color
    )

    ax.text(
        0.95,
        y,
        f"{value}",
        fontsize=12,
        ha="right",
        va="top",
        color=value_color
    )

plt.tight_layout()

plt.savefig(
    "result/topresult/trade_stats_summary.png",
    dpi=150
)

plt.close()


# === Инициализация ===
hour_stats = {str(h).zfill(2): {"total": 0, "wins": 0, "losses": 0, "none": 0, "profit": 0.0} for h in range(24)}
weekday_stats = {}

for trade in trades:
    entry_time = trade.get("entryTime")
    profit = float(trade.get("profitQuoted", 0))
    result = trade.get("result", "NONE")

    try:
        dt = datetime.strptime(entry_time, "%Y-%m-%d %H:%M:%S")
        hour = dt.strftime("%H")
        weekday = dt.strftime("%a")
    except Exception as e:
        print(f"Ошибка разбора времени {entry_time}: {e}")
        continue

    # === По часам ===
    hour_stats[hour]["total"] += 1
    hour_stats[hour]["profit"] += profit

    if result == "TAKE":
        hour_stats[hour]["wins"] += 1
    elif result == "STOP":
        hour_stats[hour]["losses"] += 1
    else:
        hour_stats[hour]["none"] += 1

    # === По дням недели ===
    if weekday not in weekday_stats:
        weekday_stats[weekday] = {"total": 0, "wins": 0, "losses": 0, "none": 0, "profit": 0.0}

    weekday_stats[weekday]["total"] += 1
    weekday_stats[weekday]["profit"] += profit

    if result == "TAKE":
        weekday_stats[weekday]["wins"] += 1
    elif result == "STOP":
        weekday_stats[weekday]["losses"] += 1
    else:
        weekday_stats[weekday]["none"] += 1


# === Заполнение недостающих дней недели ===
day_order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
for d in day_order:
    if d not in weekday_stats:
        weekday_stats[d] = {"total": 0, "wins": 0, "losses": 0, "none": 0, "profit": 0.0}


# ======================================================
# === 📊 Сделки по часам ===
# ======================================================

hours = sorted(hour_stats.keys(), key=lambda x: int(x))

wins_hour = [hour_stats[h]["wins"] for h in hours]
losses_hour = [hour_stats[h]["losses"] for h in hours]

profit_hour = [round(hour_stats[h]["profit"], 2) for h in hours]

# 🔥 НОВОЕ: средний профит на сделку (ВАЖНО)
avg_profit_per_trade = [
    (hour_stats[h]["profit"] / hour_stats[h]["total"])
    if hour_stats[h]["total"] > 0 else 0
    for h in hours
]

# сглаживание (уже нормальное)
avg_profit_hour = moving_average(avg_profit_per_trade, window_size=5)

total_trades_hour = [wins_hour[i] + losses_hour[i] for i in range(len(hours))]
avg_trades_hour2 = moving_average(total_trades_hour, window_size=5)


plt.figure(figsize=(12, 6))

plt.bar(hours, wins_hour, label="Профитные", color="green")
plt.bar(hours, losses_hour, bottom=wins_hour, label="Убыточные", color="red")

plt.plot(
    hours,
    avg_trades_hour2,
    color="blue",
    linestyle="--",
    linewidth=2,
    marker='o',
    label="Скользящее ср. сделок"
)

plt.xlabel("Час суток")
plt.ylabel("Количество сделок")
plt.title("Сделки по часам")

plt.legend()
plt.grid(True)
plt.tight_layout()
plt.savefig("result/hour_stats.png")
plt.close()


# ======================================================
# === 📈 Профит по часам (УЛУЧШЕННЫЙ)
# ======================================================

plt.figure(figsize=(12, 6))

# суммарный профит (как у тебя)
plt.bar(hours, profit_hour, color="purple", alpha=0.4, label="Total Profit")

# 🔥 НОВОЕ: средний профит (самое важное)
plt.plot(
    hours,
    avg_profit_per_trade,
    color="orange",
    linewidth=2,
    marker='o',
    label="Avg profit per trade"
)

# сглаживание
plt.plot(
    hours,
    avg_profit_hour,
    color="black",
    linestyle="--",
    linewidth=2,
    label="Smoothed avg profit"
)

# линия нуля
plt.axhline(0, linestyle="--", alpha=0.5)

plt.xlabel("Час суток")
plt.ylabel("Профит")
plt.title("Профит по часам")

plt.legend()
plt.grid(True)
plt.tight_layout()
plt.savefig("result/hour_profit.png")
plt.close()

# ======================================================
# === ТОП 10 САМЫХ ДЛИННЫХ СДЕЛОК + ИНФОРМАЦИЯ
# === (только positionNumber = 1)
# ======================================================

trade_durations = []

for trade in trades:

    # 👉 ФИЛЬТР ПО positionNumber
    if trade.get("positionNumber") != 1:
        continue

    entry_time = trade.get("entryTime")
    exit_time = trade.get("exitTime")

    if not entry_time or not exit_time:
        continue

    try:
        entry_dt = datetime.strptime(entry_time, "%Y-%m-%d %H:%M:%S")
        exit_dt = datetime.strptime(exit_time, "%Y-%m-%d %H:%M:%S")

        duration_hours = (exit_dt - entry_dt).total_seconds() / 3600

        change_percent = trade.get("changePercent", 0)
        gridDrawdownPercent = trade.get("gridDrawdownPercent", 0)
        volumeIndex = trade.get("volumeindex", 0)
        volumeIndex2 = trade.get("volumeindex2", 0)
        volumeIndex3 = trade.get("volumeindex3", 0)
        up_before_third = trade.get("maxUpBeforeThirdPercent", None)

        trade_durations.append({
            "entryTime": entry_time,
            "entryHour": entry_dt.strftime("%H:%M"),
            "hours": duration_hours,
            "changePercent": change_percent,
            "gridDrawdownPercent": gridDrawdownPercent,
            "upBeforeThird": up_before_third,
            "volumeIndex" : volumeIndex,
            "volumeIndex2" : volumeIndex2,
            "volumeIndex3" : volumeIndex3
        })

    except Exception as e:
        print("Ошибка времени:", e)


# === сортировка по длительности
trade_durations_sorted = sorted(
    trade_durations,
    key=lambda x: x["hours"],
    reverse=True
)

# === топ 10
top_trades = trade_durations_sorted[:10]

labels = [str(i + 1) for i in range(len(top_trades))]
hours = [t["hours"] for t in top_trades]

plt.figure(figsize=(13, 7))

bars = plt.bar(labels, hours)

plt.title("TOP 10 самых долгих позиций (positionNumber = 1)")
plt.xlabel("Ранг позиции")
plt.ylabel("Часы в сделке")

plt.grid(axis="y")

# === подписи информации
for i, bar in enumerate(bars):

    trade = top_trades[i]
    height = bar.get_height()

    up_text = "N/A"
    if trade["upBeforeThird"] is not None:
        up_text = f"{trade['upBeforeThird']:.2f}%"

    text = (
        f"{height:.2f}h\n"
        f"Open: {trade['entryHour']}\n"
        f"Δ: {trade['changePercent']:.2f}%\n"
        f"GDD: {trade['gridDrawdownPercent']:.2f}%\n"
        f"UP: {up_text}\n"
        f"VOL: {trade['volumeIndex']:.2f}, "
        f"VOL2: {trade['volumeIndex2']:.2f}, "
        f"VOL3: {trade['volumeIndex3']:.2f}, "
    )

    plt.text(
        bar.get_x() + bar.get_width() / 2,
        height,
        text,
        ha="center",
        va="bottom",
        fontsize=9
    )

plt.tight_layout()

plt.savefig(
    "result/topresult/top_10_longest_trades_detailed.png",
    dpi=150
)

plt.close()
# ======================================================
# === ТОП 10 САМЫХ БОЛЬШИХ ПРОСАДОК (GRID)
# === (только positionNumber = 1)
# ======================================================



trade_durations = []

for trade in trades:

    # 👉 ФИЛЬТР ПО positionNumber
    if trade.get("positionNumber") != 1:
        continue

    entry_time = trade.get("entryTime")
    exit_time = trade.get("exitTime")

    if not entry_time or not exit_time:
        continue

    try:
        entry_dt = datetime.strptime(entry_time, "%Y-%m-%d %H:%M:%S")
        exit_dt = datetime.strptime(exit_time, "%Y-%m-%d %H:%M:%S")

        duration_hours = (exit_dt - entry_dt).total_seconds() / 3600

        change_percent = trade.get("changePercent", 0)
        gridDrawdownPercent = trade.get("gridDrawdownPercent")
        volumeIndex = trade.get("volumeindex", 0)
        volumeIndex2 = trade.get("volumeindex2", 0)
        volumeIndex3 = trade.get("volumeindex3", 0)
        up_before_third = trade.get("maxUpBeforeThirdPercent", None)

        # 👉 пропускаем сделки без gridDrawdownPercent
        if gridDrawdownPercent is None:
            continue

        trade_durations.append({
            "entryTime": entry_time,
            "entryHour": entry_dt.strftime("%H:%M"),
            "hours": duration_hours,
            "changePercent": change_percent,
            "gridDrawdownPercent": gridDrawdownPercent,
            "upBeforeThird": up_before_third,
            "volumeIndex": volumeIndex,
            "volumeIndex2": volumeIndex2,
            "volumeIndex3": volumeIndex3
        })

    except Exception as e:
        print("Ошибка времени:", e)


# === сортировка по ПРОСАДКЕ
trade_durations_sorted = sorted(
    trade_durations,
    key=lambda x: x["gridDrawdownPercent"],
    reverse=True
)

# === топ 10
top_trades = trade_durations_sorted[:10]

labels = [str(i + 1) for i in range(len(top_trades))]
drawdowns = [t["gridDrawdownPercent"] for t in top_trades]

plt.figure(figsize=(13, 7))

# ❗ теперь высота = ПРОСАДКА
bars = plt.bar(labels, drawdowns)

plt.title("TOP 10 самых больших просадок (gridDrawdownPercent) — positionNumber = 1")
plt.xlabel("Ранг позиции")
plt.ylabel("Просадка (%)")  # 👈 вот это ты хотел

plt.grid(axis="y")


# === подписи информации
for i, bar in enumerate(bars):

    trade = top_trades[i]
    height = bar.get_height()

    up_text = "N/A"
    if trade["upBeforeThird"] is not None:
        up_text = f"{trade['upBeforeThird']:.2f}%"

    text = (
        f"{height:.2f}%\n"  # 👈 теперь это просадка
        f"Open: {trade['entryHour']}\n"
        f"Time: {trade['hours']:.2f}h\n"
        f"Δ: {trade['changePercent']:.2f}%\n"
        f"UP: {up_text}\n"
        f"VOL: {trade['volumeIndex']:.2f}, "
        f"VOL2: {trade['volumeIndex2']:.2f}, "
        f"VOL3: {trade['volumeIndex3']:.2f}, "
    )

    plt.text(
        bar.get_x() + bar.get_width() / 2,
        height,
        text,
        ha="center",
        va="bottom",
        fontsize=9
    )

plt.tight_layout()

plt.savefig(
    "result/topresult/top_10_grid_drawdown_trades.png",
    dpi=150
)

plt.close()

def plot_changepercent_duration(trades):

    trade_points = []

    for trade in trades:
        if trade.get("positionNumber") != 1:
            continue

        try:
            entry_dt = datetime.strptime(trade["entryTime"], "%Y-%m-%d %H:%M:%S")
            exit_dt = datetime.strptime(trade["exitTime"], "%Y-%m-%d %H:%M:%S")

            duration = (exit_dt - entry_dt).total_seconds() / 3600
            if duration <= 0:
                continue

            trade_points.append({
                "x": float(trade["changePercent"]),
                "y": duration
            })

        except:
            continue

    if not trade_points:
        print("Нет данных")
        return

    x = [t["x"] for t in trade_points]
    y = [t["y"] for t in trade_points]

    colors = ["green" if h <= 6 else "orange" if h <= 24 else "red" for h in y]
    x, y, colors = zip(*sorted(zip(x, y, colors)))

    plt.figure(figsize=(15, 7))
    plt.vlines(x, [0], y, alpha=0.15)
    plt.scatter(x, y, c=colors, alpha=0.6)

    plt.title("changePercent vs duration")
    plt.xlabel("changePercent")
    plt.ylabel("Hours")
    # === ШАГ ОСИ X (регулируешь тут)
    step = 0.2  # 👈 меняй: 0.1 / 0.2 / 0.5

    plt.xticks(np.arange(
        round(min(x), 2),
        round(max(x), 2) + step,
        step
    ))

    plt.xticks(rotation=45)
    plt.grid(True)

    short_x = [xi for xi, yi in zip(x, y) if yi <= 6]
    long_x  = [xi for xi, yi in zip(x, y) if yi >= 24]

    x_range = np.linspace(min(x), max(x), 1000)

    kde_short = gaussian_kde(short_x if len(short_x) > 1 else [0, 0.0001], bw_method=0.2)
    kde_long  = gaussian_kde(long_x  if len(long_x) > 1 else [0, 0.0001], bw_method=0.2)

    y_short = kde_short(x_range)
    y_long  = kde_long(x_range)

    y_short_scaled = y_short * max(y) * 0.4
    y_long_scaled  = y_long  * max(y) * 0.7

    plt.plot(x_range, y_short_scaled, color="green", alpha=0.7)
    plt.plot(x_range, y_long_scaled,  color="red",   alpha=0.7)

    # === EDGE
    edge = (y_short_scaled - y_long_scaled) / (y_short_scaled + y_long_scaled + 1e-9)
    edge_norm = (edge + 1) / 2
    edge_scaled = edge_norm * max(y) * 0.8

    plt.plot(x_range, edge_scaled, color="blue", linewidth=1, label="Edge")

    # === EDGE С УЧЁТОМ КОЛИЧЕСТВА (🔥)
    confidence = y_short_scaled + y_long_scaled
    confidence_norm = confidence / (np.max(confidence) + 1e-9)

    edge_weighted = edge_norm * confidence_norm
    edge_weighted_scaled = edge_weighted * max(y) * 0.9

    plt.plot(
        x_range,
        edge_weighted_scaled,
        color="purple",
        linewidth=1,
        label="Edge (weighted)"
    )

    plt.legend()
    plt.tight_layout()
    plt.savefig("result/topresult/all_trades_duration_map.png", dpi=150)
    plt.close()

def plot_candlesbetween_with_avg_positions(trades):

    from collections import defaultdict
    import numpy as np
    import matplotlib.pyplot as plt

    # candlesBetween -> список amount_of_trades
    data = defaultdict(list)

    # 🔥 ДОБАВЛЯЕМ profit
    profit_data = defaultdict(list)

    for trade in trades:
        if trade.get("positionNumber") != 1:
            continue

        cb = trade.get("candlesBetween")
        amt = trade.get("amount_of_trades")
        profit = trade.get("profitQuoted")

        if cb is None or amt is None:
            continue

        try:
            cb = int(cb)
            amt = int(amt)
            profit = float(profit) if profit is not None else 0
        except:
            continue

        data[cb].append(amt)
        profit_data[cb].append(profit)

    if not data:
        print("Нет данных")
        return

    # X — отсортированные candlesBetween
    x = sorted(data.keys())

    # Y1 — количество сделок
    counts = [len(data[val]) for val in x]

    # Y2 — среднее количество позиций
    avg_positions = [sum(data[val]) / len(data[val]) for val in x]

    # 🔥 TOTAL PROFIT
    total_profit = [sum(profit_data[val]) for val in x]

    # 🎨 цвета по плотности
    colors = [
        "green" if c <= np.percentile(counts, 33)
        else "orange" if c <= np.percentile(counts, 66)
        else "red"
        for c in counts
    ]

    plt.figure(figsize=(15, 7))

    # === ОСНОВНОЙ ГРАФИК
    plt.vlines(x, [0], counts, alpha=0.2)
    plt.scatter(x, counts, c=colors, alpha=0.7, label="Trade count")

    plt.xlabel("candlesBetween")
    plt.ylabel("Number of trades")

    # === 🔥 ДОБАВИЛИ PROFIT (та же ось)
    plt.plot(
        x,
        total_profit,
        linestyle="--",
        linewidth=2,
        marker="o",
        label="Total Profit"
    )

    # линия нуля (очень полезно)
    plt.axhline(0, linestyle=":", alpha=0.5)

    # === ВТОРАЯ ОСЬ
    ax2 = plt.gca().twinx()

    ax2.plot(
        x,
        avg_positions,
        color="blue",
        linewidth=2,
        label="Avg positions per trade"
    )

    ax2.set_ylabel("Avg amount_of_trades")

    # === шаг по X
    step = 1
    plt.xticks(np.arange(min(x), max(x) + step, step))

    plt.title("candlesBetween vs trades + avg positions + profit")

    # === объединяем легенды
    lines_1, labels_1 = plt.gca().get_legend_handles_labels()
    lines_2, labels_2 = ax2.get_legend_handles_labels()

    plt.legend(lines_1 + lines_2, labels_1 + labels_2)

    plt.grid(True)
    plt.tight_layout()

    plt.savefig("result/topresult/candlesbetween_with_avg_positions.png", dpi=150)
    plt.close()

def plot_volumeindex_duration(trades):

    trade_points = []

    for trade in trades:
        if trade.get("positionNumber") != 1:
            continue

        try:
            entry_dt = datetime.strptime(trade["entryTime"], "%Y-%m-%d %H:%M:%S")
            exit_dt = datetime.strptime(trade["exitTime"], "%Y-%m-%d %H:%M:%S")

            duration = (exit_dt - entry_dt).total_seconds() / 3600
            if duration <= 0:
                continue

            trade_points.append({
                "x": float(trade["volumeindex"]),
                "y": duration
            })

        except:
            continue

    if not trade_points:
        print("Нет данных")
        return

    x = [t["x"] for t in trade_points]
    y = [t["y"] for t in trade_points]

    colors = ["green" if h <= 6 else "orange" if h <= 24 else "red" for h in y]
    x, y, colors = zip(*sorted(zip(x, y, colors)))

    plt.figure(figsize=(15, 7))
    plt.vlines(x, [0], y, alpha=0.15)
    plt.scatter(x, y, c=colors, alpha=0.6)

    plt.title("volumeIndex vs duration")
    plt.xlabel("volumeIndex")
    plt.ylabel("Hours")
    # === ШАГ ОСИ X
    step = 0.02  # 👈 меняй: 0.01 / 0.02 / 0.05

    plt.xticks(np.arange(
        round(min(x), 2),
        round(max(x), 2) + step,
        step
    ))

    plt.xticks(rotation=45)
    plt.grid(True)

    short_x = [xi for xi, yi in zip(x, y) if yi <= 6]
    long_x  = [xi for xi, yi in zip(x, y) if yi >= 24]

    x_range = np.linspace(min(x), max(x), 1000)

    kde_short = gaussian_kde(short_x if len(short_x) > 1 else [0, 0.0001], bw_method=0.2)
    kde_long  = gaussian_kde(long_x  if len(long_x) > 1 else [0, 0.0001], bw_method=0.2)

    y_short = kde_short(x_range)
    y_long  = kde_long(x_range)

    y_short_scaled = y_short * max(y) * 0.4
    y_long_scaled  = y_long  * max(y) * 0.7

    plt.plot(x_range, y_short_scaled, color="green", alpha=0.7)
    plt.plot(x_range, y_long_scaled,  color="red",   alpha=0.7)

    # === EDGE
    edge = (y_short_scaled - y_long_scaled) / (y_short_scaled + y_long_scaled + 1e-9)
    edge_norm = (edge + 1) / 2
    edge_scaled = edge_norm * max(y) * 0.8

    plt.plot(x_range, edge_scaled, color="blue", linewidth=1, label="Edge")

    # === EDGE С УЧЁТОМ КОЛИЧЕСТВА
    confidence = y_short_scaled + y_long_scaled
    confidence_norm = confidence / (np.max(confidence) + 1e-9)

    edge_weighted = edge_norm * confidence_norm
    edge_weighted_scaled = edge_weighted * max(y) * 0.9

    plt.plot(
        x_range,
        edge_weighted_scaled,
        color="purple",
        linewidth=1,
        label="Edge (weighted)"
    )

    plt.legend()
    plt.tight_layout()
    plt.savefig("result/volume/all_trades24_volumeindex_map.png", dpi=150)
    plt.close()


def plot_volumeindex_duration2(trades):

    from collections import defaultdict
    import numpy as np
    import matplotlib.pyplot as plt
    from datetime import datetime

    trade_points = []

    # 🔥 для профита
    profit_data = defaultdict(list)

    for trade in trades:
        if trade.get("positionNumber") != 1:
            continue

        try:
            entry_dt = datetime.strptime(trade["entryTime"], "%Y-%m-%d %H:%M:%S")
            exit_dt = datetime.strptime(trade["exitTime"], "%Y-%m-%d %H:%M:%S")

            duration = (exit_dt - entry_dt).total_seconds() / 3600
            if duration <= 0:
                continue

            x_val = float(trade["volumeindex2"])
            profit = float(trade.get("profitQuoted", 0))

            trade_points.append({
                "x": x_val,
                "y": duration
            })

            # 🔥 округляем чтобы сгруппировать
            x_rounded = round(x_val, 2)
            profit_data[x_rounded].append(profit)

        except:
            continue

    if not trade_points:
        print("Нет данных")
        return

    x = [t["x"] for t in trade_points]
    y = [t["y"] for t in trade_points]

    colors = ["green" if h <= 6 else "orange" if h <= 24 else "red" for h in y]
    x, y, colors = zip(*sorted(zip(x, y, colors)))

    plt.figure(figsize=(15, 7))

    # === ТВОЙ ГРАФИК
    plt.vlines(x, [0], y, alpha=0.15)
    plt.scatter(x, y, c=colors, alpha=0.6)

    plt.title("volumeIndex2 vs duration + profit")
    plt.xlabel("volumeIndex2")
    plt.ylabel("Hours")

    # === ОСЬ X
    step = 0.02
    plt.xticks(np.arange(
        round(min(x), 2),
        round(max(x), 2) + step,
        step
    ))
    plt.xticks(rotation=45)

    plt.grid(True)

    # ======================================================
    # 🔥 PROFIT LINE (вот это главное)
    # ======================================================

    x_profit = sorted(profit_data.keys())
    total_profit = [sum(profit_data[val]) for val in x_profit]

    plt.plot(
        x_profit,
        total_profit,
        color="blue",
        linewidth=2,
        marker="o",
        label="Total Profit"
    )

    # линия нуля
    plt.axhline(0, linestyle="--", alpha=0.5)

    plt.legend()
    plt.tight_layout()

    plt.savefig("result/volume/all_trades12_volumeindex_map.png", dpi=150)
    plt.close()

def plot_volumeindex_duration3(trades):

    trade_points = []

    for trade in trades:
        if trade.get("positionNumber") != 1:
            continue

        try:
            entry_dt = datetime.strptime(trade["entryTime"], "%Y-%m-%d %H:%M:%S")
            exit_dt = datetime.strptime(trade["exitTime"], "%Y-%m-%d %H:%M:%S")

            duration = (exit_dt - entry_dt).total_seconds() / 3600
            if duration <= 0:
                continue

            trade_points.append({
                "x": float(trade["volumeindex3"]),
                "y": duration
            })

        except:
            continue

    if not trade_points:
        print("Нет данных")
        return

    x = [t["x"] for t in trade_points]
    y = [t["y"] for t in trade_points]

    colors = ["green" if h <= 6 else "orange" if h <= 24 else "red" for h in y]
    x, y, colors = zip(*sorted(zip(x, y, colors)))

    plt.figure(figsize=(15, 7))
    plt.vlines(x, [0], y, alpha=0.15)
    plt.scatter(x, y, c=colors, alpha=0.6)

    plt.title("volumeIndex3 vs duration")
    plt.xlabel("volumeIndex3")
    plt.ylabel("Hours")
    # === ШАГ ОСИ X
    step = 0.02  # 👈 меняй: 0.01 / 0.02 / 0.05

    plt.xticks(np.arange(
        round(min(x), 2),
        round(max(x), 2) + step,
        step
    ))

    plt.xticks(rotation=45)
    plt.grid(True)

    short_x = [xi for xi, yi in zip(x, y) if yi <= 6]
    long_x  = [xi for xi, yi in zip(x, y) if yi >= 24]

    x_range = np.linspace(min(x), max(x), 1000)

    kde_short = gaussian_kde(short_x if len(short_x) > 1 else [0, 0.0001], bw_method=0.2)
    kde_long  = gaussian_kde(long_x  if len(long_x) > 1 else [0, 0.0001], bw_method=0.2)

    y_short = kde_short(x_range)
    y_long  = kde_long(x_range)

    y_short_scaled = y_short * max(y) * 0.4
    y_long_scaled  = y_long  * max(y) * 0.7

    plt.plot(x_range, y_short_scaled, color="green", alpha=0.7)
    plt.plot(x_range, y_long_scaled,  color="red",   alpha=0.7)

    # === EDGE
    edge = (y_short_scaled - y_long_scaled) / (y_short_scaled + y_long_scaled + 1e-9)
    edge_norm = (edge + 1) / 2
    edge_scaled = edge_norm * max(y) * 0.8

    plt.plot(x_range, edge_scaled, color="blue", linewidth=1, label="Edge")

    # === EDGE С УЧЁТОМ КОЛИЧЕСТВА
    confidence = y_short_scaled + y_long_scaled
    confidence_norm = confidence / (np.max(confidence) + 1e-9)

    edge_weighted = edge_norm * confidence_norm
    edge_weighted_scaled = edge_weighted * max(y) * 0.9

    plt.plot(
        x_range,
        edge_weighted_scaled,
        color="purple",
        linewidth=1,
        label="Edge (weighted)"
    )

    plt.legend()
    plt.tight_layout()
    plt.savefig("result/volume/all_trades48_volumeindex_map.png", dpi=150)
    plt.close()

plot_candlesbetween_with_avg_positions(trades)
plot_changepercent_duration(trades)
plot_volumeindex_duration(trades)
plot_volumeindex_duration2(trades)
plot_volumeindex_duration3(trades)

"""

# === 📅 Сделки по дням недели ===
wins_day = [weekday_stats[d]["wins"] for d in day_order]
losses_day = [weekday_stats[d]["losses"] for d in day_order]
profit_day = [round(weekday_stats[d]["profit"], 2) for d in day_order]
avg_profit_day = moving_average(profit_day, window_size=5)
total_trades_day = [wins_day[i] + losses_day[i] for i in range(len(day_order))]
avg_trades_day = moving_average(total_trades_day, window_size=5)

plt.figure(figsize=(10, 5))
plt.bar(day_order, wins_day, label="Профитные", color="blue")
plt.bar(day_order, losses_day, bottom=wins_day, label="Убыточные", color="orange")
plt.plot(day_order, avg_trades_day, color="purple", linestyle="--", linewidth=2, marker='o', label="Скользящее ср. сделок")
plt.xlabel("День недели")
plt.ylabel("Количество сделок")
plt.title("Сделки по дням недели")
plt.legend()
plt.grid(True)
plt.tight_layout()
plt.savefig("result/weekday_stats.png")
plt.close()

# === 📉 Профит по дням недели + скользящее среднее ===
plt.figure(figsize=(10, 5))
plt.bar(day_order, profit_day, color="teal", label="Профит")
plt.plot(day_order, avg_profit_day, color="black", linestyle="--", linewidth=2, marker='o', label="Скользящее среднее")
plt.xlabel("День недели")
plt.ylabel("Суммарный профит")
plt.title("Профит по дням недели")
plt.legend()
plt.grid(True)
plt.tight_layout()
plt.savefig("result/weekday_profit.png")
plt.close()
"""

"""
# Количество лонг шорт позиций
# Инициализация счётчиков
stats2 = {
    "LONG": {"TAKE": 0, "STOP": 0, "NONE": 0},
    "SHORT": {"TAKE": 0, "STOP": 0, "NONE": 0},
}

# Подсчёт
for trade in trades:
    direction = trade.get("direction", "UNKNOWN")
    result = trade.get("result", "NONE")
    
    if direction in stats2:
        if result not in stats2[direction]:
            stats2[direction][result] = 0
        stats2[direction][result] += 1

# Подготовка данных
directions = ["LONG", "SHORT"]
take_counts = [stats2[d]["TAKE"] for d in directions]
stop_counts = [stats2[d]["STOP"] for d in directions]

# Построение графика
x = range(len(directions))
width = 0.35

plt.figure(figsize=(8, 6))
plt.bar(x, take_counts, width, label="Профитные (TAKE)", color="green")
plt.bar([i + width for i in x], stop_counts, width, label="Убыточные (STOP)", color="red")

plt.xlabel("Направление сделки")
plt.ylabel("Количество сделок")
plt.title("Количество TAKE / STOP по направлению (LONG / SHORT)")
plt.xticks([i + width / 2 for i in x], directions)
plt.legend()
plt.grid(True)
plt.tight_layout()

# Сохранение
os.makedirs("result", exist_ok=True)
plt.savefig("result/direction_stats.png")
plt.close()
"""
"""
# Количество позиций по дистанции
# Извлечение дистанций (с учетом результата сделки)
long_distances = []
short_distances = []

for trade in trades:
    entry = trade.get("entryPriceWithSpread")
    exit_ = trade.get("exitPriceWithSpread")
    direction = trade.get("direction")
    result = trade.get("result")

    if entry is not None and exit_ is not None and direction in ["LONG", "SHORT"]:
        distance = abs(entry - exit_) * 10000  # в пунктах

        # Делаем отрицательным, если убыточная
        if result == "STOP":
            distance *= -1

        if direction == "LONG":
            long_distances.append(distance)
        else:
            short_distances.append(distance)

# KDE-функция
def plot_density(data, label, color):
    if len(data) < 5:
        print(f"Недостаточно данных для {label}")
        return

    kde = gaussian_kde(data)
    x_vals = np.linspace(min(data) * 1.1, max(data) * 1.1, 500)
    y_vals = kde(x_vals)
    plt.plot(x_vals, y_vals, label=label, color=color)

# Построение графика
plt.figure(figsize=(10, 6))
plot_density(long_distances, "LONG", "blue")
plot_density(short_distances, "SHORT", "red")

plt.axvline(0, color="black", linestyle="--")  # Вертикальная линия по нулю
plt.title("Распределение дистанций (± прибыль/убыток)")
plt.xlabel("Дистанция сделки (пункты)")
plt.ylabel("Плотность")
plt.legend()
plt.grid(True)
plt.tight_layout()

# Сохранение
os.makedirs("result", exist_ok=True)
plt.savefig("result/distance_density_signed.png")
plt.close()
"""
"""

# 📈 2D-график: накопленная площадь профита/убытка
# === 📈 2D-график: накопленная прибыль/убыток по времени ===
# 📈 Графики: накопленная прибыль/убыток по сделкам и по времени
# 📈 График 1: накопленный профит по НОМЕРУ сделки
cumulative_profit = 0
cumulative_profits = []
cumulative_losses = []
cumulative_balance = []

for trade in trades:
    profit = float(trade.get("profitQuoted", 0))
    cumulative_profit += profit
    cumulative_balance.append(cumulative_profit)
    cumulative_profits.append(profit if profit > 0 else 0)
    cumulative_losses.append(profit if profit < 0 else 0)

x_index = list(range(len(trades)))

plt.figure(figsize=(14, 6))
plt.fill_between(x_index, cumulative_profits, color="green", alpha=0.4, label="Прибыль")
plt.fill_between(x_index, cumulative_losses, color="red", alpha=0.4, label="Убыток")
plt.plot(x_index, cumulative_balance, color="black", linewidth=2, label="Баланс")
plt.axhline(0, color="gray", linestyle="--")
plt.xlabel("Номер сделки")
plt.ylabel("Накопленный профит")
plt.title("Накопленная прибыль/убыток по количеству сделок")
plt.legend()
plt.grid(True)
plt.tight_layout()
plt.savefig("result/profit_by_index.png")
plt.close()
"""
# 📈 График 2: накопленный профит по ВРЕМЕНИ
cumulative_profit = 0
cumulative_profits_time = []
cumulative_losses_time = []
cumulative_balance_time = []
entry_times = []

for trade in trades:
    profit = float(trade.get("profitQuoted", 0))
    entry_time_str = trade.get("entryTime")
    try:
        entry_dt = datetime.strptime(entry_time_str, "%Y-%m-%d %H:%M:%S")
    except Exception as e:
        print(f"Ошибка разбора entryTime: {entry_time_str} — {e}")
        continue

    cumulative_profit += profit
    cumulative_balance_time.append(cumulative_profit)
    cumulative_profits_time.append(profit if profit > 0 else 0)
    cumulative_losses_time.append(profit if profit < 0 else 0)
    entry_times.append(entry_dt)

# Сортировка по времени
sorted_data = sorted(zip(entry_times, cumulative_profits_time, cumulative_losses_time, cumulative_balance_time), key=lambda x: x[0])
entry_times_sorted, profits_sorted, losses_sorted, balance_sorted = map(list, zip(*sorted_data))

plt.figure(figsize=(14, 6))
plt.fill_between(entry_times_sorted, profits_sorted, color="green", alpha=0.4, label="Прибыль")
plt.fill_between(entry_times_sorted, losses_sorted, color="red", alpha=0.4, label="Убыток")
plt.plot(entry_times_sorted, balance_sorted, color="black", linewidth=2, label="Баланс")
plt.axhline(0, color="gray", linestyle="--")
plt.xlabel("Время сделки")
plt.ylabel("Накопленный профит")
plt.title("Накопленная прибыль/убыток по времени")
plt.legend()
plt.grid(True)
plt.tight_layout()
plt.savefig("result/topresult/profit_by_time.png")
plt.close()



# === Инициализация ===
duration_hour_stats = {str(h).zfill(2): {"total": 0, "duration_sum": 0.0, "duration_avg": 0.0} for h in range(24)}

for trade in trades:
    # === фильтр по positionNumber ===
    if trade.get("positionNumber") != 1:
        continue

    entry_time = trade.get("entryTime")
    exit_time = trade.get("exitTime")

    if not entry_time or not exit_time:
        continue

    try:
        dt_entry = datetime.strptime(entry_time, "%Y-%m-%d %H:%M:%S")
        dt_exit = datetime.strptime(exit_time, "%Y-%m-%d %H:%M:%S")
        hour = dt_entry.strftime("%H")
    except Exception as e:
        print(f"Ошибка разбора времени {entry_time} или {exit_time}: {e}")
        continue

    # === длительность в часах ===
    duration_hours = (dt_exit - dt_entry).total_seconds() / 3600

    duration_hour_stats[hour]["total"] += 1
    duration_hour_stats[hour]["duration_sum"] += duration_hours

# === расчёт среднего ===
for h in duration_hour_stats:
    if duration_hour_stats[h]["total"] > 0:
        duration_hour_stats[h]["duration_avg"] = duration_hour_stats[h]["duration_sum"] / duration_hour_stats[h]["total"]


hours = sorted(duration_hour_stats.keys(), key=lambda x: int(x))
duration_sum_hour = [round(duration_hour_stats[h]["duration_sum"], 2) for h in hours]
duration_avg_hour = [round(duration_hour_stats[h]["duration_avg"], 2) for h in hours]
total_trades_hour = [duration_hour_stats[h]["total"] for h in hours]

plt.figure(figsize=(12, 6))
plt.bar(hours, duration_sum_hour, color="blue")
plt.xlabel("Час суток")
plt.ylabel("Суммарная длительность (часы)")
plt.title("Суммарная длительность сделок (positionNumber=1) по часам")
plt.grid(True)
plt.tight_layout()
plt.savefig("result/hour_duration_sum_pos1.png")
plt.close()

plt.figure(figsize=(12, 6))
plt.bar(hours, duration_avg_hour, label="Средняя длительность (ч)", color="orange")
plt.plot(hours, total_trades_hour, color="black", linestyle="--", marker='o', label="Количество сделок")
plt.xlabel("Час суток")
plt.ylabel("Длительность (часы)")
plt.title("Средняя длительность сделок (positionNumber=1) по часам")
plt.legend()
plt.grid(True)
plt.tight_layout()
plt.savefig("result/hour_duration_avg_pos1.png")
plt.close()




duration_weekday_stats = {d: {"total": 0, "duration_sum": 0.0, "duration_avg": 0.0} for d in day_order}
for trade in trades:
    # фильтр
    if trade.get("positionNumber") != 1:
        continue

    entry_time = trade.get("entryTime")
    exit_time = trade.get("exitTime")

    if not entry_time or not exit_time:
        continue

    try:
        dt_entry = datetime.strptime(entry_time, "%Y-%m-%d %H:%M:%S")
        dt_exit = datetime.strptime(exit_time, "%Y-%m-%d %H:%M:%S")
        weekday = dt_entry.strftime("%a")   # Mon, Tue, Wed, ...
    except Exception as e:
        print(f"Ошибка разбора времени {entry_time} или {exit_time}: {e}")
        continue

    duration_hours = (dt_exit - dt_entry).total_seconds() / 3600

    duration_weekday_stats[weekday]["total"] += 1
    duration_weekday_stats[weekday]["duration_sum"] += duration_hours

for d in duration_weekday_stats:
    if duration_weekday_stats[d]["total"] > 0:
        duration_weekday_stats[d]["duration_avg"] = duration_weekday_stats[d]["duration_sum"] / duration_weekday_stats[d]["total"]



days = day_order
duration_sum_weekday = [round(duration_weekday_stats[d]["duration_sum"], 2) for d in days]
duration_avg_weekday = [round(duration_weekday_stats[d]["duration_avg"], 2) for d in days]
total_trades_weekday = [duration_weekday_stats[d]["total"] for d in days]

plt.figure(figsize=(10, 5))
plt.bar(days, duration_sum_weekday, color="steelblue")
plt.xlabel("День недели")
plt.ylabel("Суммарная длительность (часы)")
plt.title("Суммарная длительность сделок (positionNumber=1) по дням недели")
plt.grid(True, axis='y')
plt.tight_layout()
plt.savefig("result/weekday_duration_sum_pos1.png")
plt.close()

plt.figure(figsize=(10, 5))
plt.bar(days, duration_avg_weekday, label="Средняя длительность (ч)", color="orange")
plt.plot(days, total_trades_weekday, color="black", linestyle="--", marker='o', label="Количество сделок")
plt.xlabel("День недели")
plt.ylabel("Длительность / Кол-во")
plt.title("Средняя длительность сделок (positionNumber=1) по дням недели")
plt.legend()
plt.grid(True)
plt.tight_layout()
plt.savefig("result/weekday_duration_avg_pos1.png")
plt.close()

# === ИНИЦИАЛИЗАЦИЯ ===
profit_weekday_stats = {
    d: {"total": 0, "profit_sum": 0.0, "profit_avg": 0.0}
    for d in day_order
}

for trade in trades:
    # фильтр
    if trade.get("positionNumber") != 1:
        continue

    entry_time = trade.get("entryTime")
    profit = trade.get("profitQuoted")

    if not entry_time or profit is None:
        continue

    try:
        dt_entry = datetime.strptime(entry_time, "%Y-%m-%d %H:%M:%S")
        weekday = dt_entry.strftime("%a")  # Mon, Tue, ...
        profit = float(profit)
    except Exception as e:
        print(f"Ошибка разбора времени {entry_time}: {e}")
        continue

    profit_weekday_stats[weekday]["total"] += 1
    profit_weekday_stats[weekday]["profit_sum"] += profit


# === СЧИТАЕМ СРЕДНИЙ ПРОФИТ ===
for d in profit_weekday_stats:
    if profit_weekday_stats[d]["total"] > 0:
        profit_weekday_stats[d]["profit_avg"] = (
            profit_weekday_stats[d]["profit_sum"] /
            profit_weekday_stats[d]["total"]
        )


# ======================================================
# === ГРАФИК
# ======================================================

days = day_order

profit_sum_weekday = [
    round(profit_weekday_stats[d]["profit_sum"], 2)
    for d in days
]

profit_avg_weekday = [
    round(profit_weekday_stats[d]["profit_avg"], 2)
    for d in days
]


plt.figure(figsize=(10, 5))

# === СУММАРНЫЙ ПРОФИТ (как у тебя было)
plt.bar(days, profit_sum_weekday, color="steelblue", alpha=0.4, label="Total Profit")

# === СРЕДНИЙ ПРОФИТ (самое важное)
plt.plot(
    days,
    profit_avg_weekday,
    color="orange",
    linewidth=2,
    marker='o',
    label="Avg Profit per Trade"
)

# линия нуля
plt.axhline(0, linestyle="--", alpha=0.5)

plt.xlabel("День недели")
plt.ylabel("Профит")
plt.title("Профит по дням недели (positionNumber=1)")

plt.legend()
plt.grid(True, axis='y')
plt.tight_layout()

plt.savefig("result/weekday_profit_pos1.png")
plt.close()
"""
# === 📈 Кривая накопленной дистанции (без знака) ===
timestamps = []
distances = []

for trade in trades:
    entry = trade.get("entryPrice")
    exit_ = trade.get("exitPrice")
    time_str = trade.get("entryTime")

    if entry is not None and exit_ is not None and time_str:
        distance = abs(entry - exit_) * 10000  # абсолютная дистанция в пипсах

        try:
            dt = datetime.fromisoformat(time_str.replace("Z", "+00:00"))
            timestamps.append(dt)
            distances.append(distance)
        except Exception as e:
            print(f"⚠️ Ошибка разбора даты: {time_str} — {e}")

# Упорядочим по времени
sorted_data = sorted(zip(timestamps, distances), key=lambda x: x[0])
sorted_times, sorted_distances = zip(*sorted_data)

# Кумулятивная сумма дистанций
cumulative_distance = np.cumsum(sorted_distances)

# Построение графика
plt.figure(figsize=(14, 6))
plt.plot(sorted_times, cumulative_distance, color="darkorange", linewidth=2)
plt.xlabel("Время")
plt.ylabel("Накопленная дистанция (в пипсах)")
plt.title("Суммарная дистанция сделок во времени")
plt.grid(True)
plt.tight_layout()
os.makedirs("result", exist_ok=True)
plt.savefig("result/time_total_distance.png")
plt.close()

# Сбор данных по датам
# === Сбор дистанций по дням ===
# === Проверка структуры ===
if not isinstance(trades, list):
    raise ValueError("Файл trades.json должен содержать список сделок.")

# === Сбор дистанций по дням ===
dist_per_day = defaultdict(float)
skipped = 0

for trade in trades:
    entry = trade.get("entryPrice")
    exit_ = trade.get("exitPrice")
    time_str = trade.get("entryTime")

    if entry is None or exit_ is None or time_str is None:
        skipped += 1
        continue

    try:
        entry = float(entry)
        exit_ = float(exit_)
        dt = parse_datetime(time_str)
        day_key = dt.strftime("%Y-%m-%d")
        distance = abs(entry - exit_) * 10000  # в пипсах
        dist_per_day[day_key] += distance
    except Exception as e:
        print(f"Ошибка при обработке записи: {trade}\n{e}")
        skipped += 1

print(f"Обработано {len(dist_per_day)} дней, пропущено сделок: {skipped}")

# === Проверка наличия данных ===
if not dist_per_day:
    raise ValueError("Нет данных для построения графика — проверь содержимое trades.json")

# === Подготовка данных для графика ===
dates = sorted(dist_per_day.keys(), key=lambda d: parse_datetime(d))
distances = [dist_per_day[date] for date in dates]

# === Построение графика ===
plt.figure(figsize=(12, 6))
plt.bar(dates, distances, color="skyblue")
plt.ylabel("Суммарная дистанция (в пипсах)")
plt.xlabel("Дата")
plt.title("Объём движения сделок по дням (аналог Volume Profile)")
plt.xticks(rotation=45, ha='right')  # повернуть даты для читаемости
plt.tight_layout()
plt.grid(True)

# === Сохранение ===
os.makedirs("result", exist_ok=True)
plt.savefig("result/volume_distance_profile.png")
plt.close()

# === Расчёт вероятности тейка ===
hours = [str(h).zfill(2) for h in range(24)]
tp_probabilities = []

for h in hours:
    total = hour_stats[h]["total"]
    wins = hour_stats[h]["wins"]

    if total > 0:
        prob = wins / total * 100
    else:
        prob = 0

    tp_probabilities.append(prob)

# === Построение графика ===

plt.figure(figsize=(14, 6))
plt.title("Вероятность достижения тейка по часам (%)", fontsize=16)

bars = plt.bar(hours, tp_probabilities, color="#7C1A8B", alpha=0.85)

# Добавление процентов над столбцами
for bar, prob in zip(bars, tp_probabilities):
    height = bar.get_height()
    plt.text(
        bar.get_x() + bar.get_width()/2,
        height + 0.5,
        f"{prob:.1f}%",
        ha="center",
        va="bottom",
        fontsize=10
    )

plt.xlabel("Час суток")
plt.ylabel("Вероятность тейка (%)")
plt.grid(axis="y", linestyle="--", alpha=0.4)

plt.tight_layout()
plt.savefig("result/hourly_tp_probability.png", dpi=150)
plt.close()



def load_fear_greed_index(path):
    with open(path, "r") as f:
        data = json.load(f)

    d = {}
    for item in data:
        dt = datetime.fromisoformat(item["time"].replace("Z", ""))
        key = dt.strftime("%Y-%m-%d")
        d[key] = item["fearGreedIndex"]

    return d


fear_greed = load_fear_greed_index("news/result/fear_greed_index.json")

bins = np.linspace(0, 100, 51)  # шаг = 2
bin_win = np.zeros(len(bins) - 1)
bin_total = np.zeros(len(bins) - 1)

used_trades = 0

for tr in trades:
    dt = datetime.strptime(tr["entryTime"], "%Y-%m-%d %H:%M:%S")
    key = dt.strftime("%Y-%m-%d")

    if key not in fear_greed:
        continue

    used_trades += 1

    val = fear_greed[key]
    idx = np.digitize(val, bins) - 1

    if 0 <= idx < len(bin_win):
        bin_total[idx] += 1
        if tr["result"] == "TAKE":
            bin_win[idx] += 1


# ---------- PLOT ----------
plt.figure(figsize=(14, 4))
plt.bar(bins[:-1], bin_total, width=1.8)
plt.grid(True)

plt.title(
    f"Fear & Greed Index — Trades count "
    f"(used trades: {used_trades})"
)

plt.xlabel("Fear & Greed Index")
plt.ylabel("Trades")

plt.savefig("result/fear_greed_trades_count.png")
plt.close()

def load_funding(path):
    with open(path, "r") as f:
        data = json.load(f)

    d = {}
    for item in data:
        dt = datetime.fromisoformat(item["time"].replace("Z", ""))
        key = dt.strftime("%Y-%m-%d %H:00")
        d[key] = item["fundingRate"]

    return d


# ---------- LOAD DATA ----------
funding = load_funding("news/eth_funding_rate_year.json")

# массив всех значений funding (для min / max и биннинга)
funding_values = np.array(list(funding.values()))
f_min = funding_values.min()
f_max = funding_values.max()


# ---------- BINS ----------
bins = np.linspace(f_min, f_max, 40)  # более детально
bin_win = np.zeros(len(bins) - 1)
bin_total = np.zeros(len(bins) - 1)


# ---------- CALCULATE WINRATE ----------
for tr in trades:
    dt = datetime.strptime(tr["entryTime"], "%Y-%m-%d %H:%M:%S")
    key = dt.strftime("%Y-%m-%d %H:00")

    if key not in funding:
        continue

    val = funding[key]
    idx = np.digitize(val, bins) - 1

    if 0 <= idx < len(bin_win):
        bin_total[idx] += 1
        if tr["result"] == "TAKE":
            bin_win[idx] += 1


winrate = np.divide(
    bin_win,
    bin_total,
    out=np.zeros_like(bin_win),
    where=bin_total > 0
)

# фильтр от шума (минимум сделок на бин)
min_trades = 5
winrate_filtered = np.where(bin_total >= min_trades, winrate, np.nan)


# ---------- PLOT ----------
plt.figure(figsize=(14, 6))

plt.plot(
    bins[:-1],
    winrate_filtered,
    marker="o",
    label="Winrate"
)

# линии min / max funding
plt.axvline(
    f_min,
    linestyle="--",
    linewidth=1.5,
    label=f"Min funding ({f_min:.5f})"
)

plt.axvline(
    f_max,
    linestyle="--",
    linewidth=1.5,
    label=f"Max funding ({f_max:.5f})"
)

plt.grid(True)
plt.title("ETH Funding Rate — Winrate (Day Trading)")
plt.xlabel("Funding Rate")
plt.ylabel("Winrate")
plt.legend()

plt.savefig("result/eth_funding_winrate.png")
plt.close()



# ===============================
# Загрузка SMA из CSV
# ===============================
def load_sma_csv(path):
    d = {}
    with open(path, "r") as f:
        reader = csv.reader(f)

        for row in reader:
            if not row:
                continue

            # пропуск заголовков
            if row[0].lower() in ("time", "date", "datetime"):
                continue

            # если нет значения SMA — пропускаем
            if len(row) < 2 or row[1].strip() == "":
                continue

            try:
                dt = datetime.strptime(row[0], "%Y-%m-%d %H:%M:%S")
                value = float(row[1])
            except ValueError:
                continue

            key = dt.strftime("%Y-%m-%d %H:%M")
            d[key] = value

    return d




sma_fast = load_sma_csv("backtest/indicator/sma1200.csv")
sma_slow = load_sma_csv("backtest/indicator/sma1680.csv")


# ===============================
# Контейнеры для профита по фазам
# ===============================
phase_profit = {
    "fast_above": [],  # SMA15 > SMA50
    "fast_below": []   # SMA15 < SMA50
}

used_trades = 0


# ===============================
# Разбор сделок
# ===============================
for tr in trades:
    dt = datetime.strptime(tr["entryTime"], "%Y-%m-%d %H:%M:%S")
    key = dt.strftime("%Y-%m-%d %H:%M")

    if key not in sma_fast or key not in sma_slow:
        continue

    used_trades += 1
    profit = tr["profitQuoted"]  # <-- ВАЖНО

    if sma_fast[key] > sma_slow[key]:
        phase_profit["fast_above"].append(profit)
    else:
        phase_profit["fast_below"].append(profit)


# ===============================
# Статистика
# ===============================
def stats(arr):
    if not arr:
        return {"count": 0, "sum": 0, "mean": 0}
    return {
        "count": len(arr),
        "sum": float(np.sum(arr)),
        "mean": float(np.mean(arr))
    }


stats_above = stats(phase_profit["fast_above"])
stats_below = stats(phase_profit["fast_below"])


# ===============================
# Вывод статистики в консоль
# ===============================
print("=== Long Phase ===")
print(stats_above)

print("\n=== Short Phase ===")
print(stats_below)

print(f"\nUsed trades: {used_trades}")


# ===============================
# График Total Profit
# ===============================
labels = ["=== Long Phase ===", "=== Short Phase ==="]
total_profits = [
    stats_above["sum"],
    stats_below["sum"]
]

plt.figure(figsize=(8, 5))
plt.bar(labels, total_profits)
plt.grid(True, axis="y")

plt.title(
    "Total Profit by SMA Phase\n"
    f"Used trades: {used_trades}"
)
plt.ylabel("Total Profit (Quoted)")

plt.tight_layout()
plt.savefig("result/sma_phase_total_profit.png")
plt.close()


# === Начальный баланс ===
start_balance = 0
balance = start_balance

balances = [balance]
profits = []

for trade in trades:
    raw_profit = abs(float(trade.get("profitQuoted", 0)))
    result = trade.get("result")

    if result == "TAKE":
        profit = raw_profit
    elif result == "STOP":
        profit = -raw_profit
    else:
        profit = 0  # BE / неизвестно

    balance += profit
    balances.append(balance)
    profits.append(profit)

x = list(range(len(balances)))

# Цвета точек
colors = ["green" if p > 0 else "red" for p in profits]

# === График ===
plt.figure(figsize=(14, 7))

plt.plot(
    x,
    balances,
    drawstyle="steps-post",
    linewidth=2.5,
    color="black",
    label="Баланс"
)

plt.scatter(
    x[1:],
    balances[1:],
    c=colors,
    s=70,
    zorder=3,
    label="Сделки"
)

plt.axhline(start_balance, color="gray", linestyle="--", alpha=0.5)

plt.xlabel("Номер сделки")
plt.ylabel("Баланс")
plt.title("Equity Curve — корректно по базе сделок")
plt.grid(True, alpha=0.3)
plt.legend()
plt.tight_layout()

plt.savefig("result/equity_curve_FIXED_FINAL.png")
plt.close()
"""


print("Графики успешно сохранены:")
print("- result/hour_stats.png")
print("- result/hour_profit.png")
print("- result/weekday_stats.png")
print("- result/weekday_profit.png")
