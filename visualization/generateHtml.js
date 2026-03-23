const fs = require('fs');
const csv = require('csv-parser');

function generateHtml(filePath, sessionRanges, tradesPath, startTime, endTime, sma1, sma2, sma3) {
    const data = [];
    
    fs.createReadStream(filePath)
        .pipe(csv(['datetime', 'open', 'high', 'low', 'close', 'volume', 'bidVolume', 'askVolume']))
        .on('data', (row) => {
            data.push({
                datetime: row.datetime,
                open: parseFloat(row.open),
                high: parseFloat(row.high),
                low: parseFloat(row.low),
                close: parseFloat(row.close)
            });
        })
        .on('end', () => {

            // 🔄 Фильтрация по startTime и endTime
            const filteredData = data.filter(d => {
                const time = new Date(d.datetime.replace(" ", "T")).getTime();
                return (!startTime || new Date(startTime).getTime() <= time) &&
                       (!endTime || time <= new Date(endTime).getTime());
            });

            // 🚀 АГРЕГАЦИЯ СВЕЧЕЙ (БЕЗ ПОТЕРИ DATETIME ДЛЯ СДЕЛОК)
            const MAX_CANDLES = 3000;
            let finalData = filteredData;

            if (filteredData.length > MAX_CANDLES) {
                const step = Math.ceil(filteredData.length / MAX_CANDLES);
                const aggregated = [];

                for (let i = 0; i < filteredData.length; i += step) {
                    const chunk = filteredData.slice(i, i + step);
                    if (chunk.length === 0) continue;

                    aggregated.push({
                        datetime: chunk[0].datetime,
                        datetimes: chunk.map(d => d.datetime), // 🔥 ключ для сделок
                        open: chunk[0].open,
                        close: chunk[chunk.length - 1].close,
                        high: Math.max(...chunk.map(d => d.high)),
                        low: Math.min(...chunk.map(d => d.low))
                    });
                }

                finalData = aggregated;
            }

            // 🔄 Загрузка трейдов
            const trades = tradesPath ? JSON.parse(fs.readFileSync(tradesPath, 'utf8')) : [];

            const smaData1 = [];
            const smaData2 = [];
            const smaData3 = [];
            if (sma1) {
                const lines = fs.readFileSync(sma1, 'utf8').split('\n');
                for (const line of lines) {
                    const [datetime, value] = line.trim().split(',');
                    if (datetime && value) {
                        smaData1.push({ datetime, value: parseFloat(value) });
                    }
                }
            }
            if (sma2) {
                const lines = fs.readFileSync(sma2, 'utf8').split('\n');
                for (const line of lines) {
                    const [datetime, value] = line.trim().split(',');
                    if (datetime && value) {
                        smaData2.push({ datetime, value: parseFloat(value) });
                    }
                }
            }
            sma3 = null;
            if (sma3) {
                const lines = fs.readFileSync(sma3, 'utf8').split('\n');
                for (const line of lines) {
                    const [datetime, value] = line.trim().split(',');
                    if (datetime && value) {
                        smaData3.push({ datetime, value: parseFloat(value) });
                    }
                }
            }

            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8" />
                    <style>
                        body {
                            margin: 0;
                            padding: 0;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            height: 100vh;
                            background-color: #f5f5f5;
                        }
                        svg {
                            border: 1px solid #ccc;
                        }
                    </style>
                    <script src="https://d3js.org/d3.v7.min.js"></script>
                </head>
                <body>
                    <svg width="2300" height="1200"></svg>
                    <script>
                        const data = ${JSON.stringify(finalData)};
                        const trades = ${JSON.stringify(trades)};
                        const sessionRanges = ${JSON.stringify(sessionRanges)};
                        const smaData1 = ${JSON.stringify(smaData1)};
                        const smaData2 = ${JSON.stringify(smaData2)};
                        const smaData3 = ${JSON.stringify(smaData3)};

                        const svg = d3.select("svg");
                        const margin = {top: 40, right: 20, bottom: 40, left: 80};
                        const width = +svg.attr("width") - margin.left - margin.right;
                        const height = +svg.attr("height") - margin.top - margin.bottom;

                        // 🔥 FIX: индексируем ВСЕ datetime (включая агрегированные)
                        const indexMap = new Map();
                        data.forEach((d, i) => {
                            if (d.datetimes) {
                                d.datetimes.forEach(dt => indexMap.set(dt, i));
                            } else {
                                indexMap.set(d.datetime, i);
                            }
                        });

                        const x = d3.scaleBand()
                            .domain(data.map((_, i) => i))
                            .range([margin.left, width + margin.left])
                            .padding(0.3);

                        const y = d3.scaleLinear()
                            .domain([
                                d3.min(data, d => d.low),
                                d3.max(data, d => d.high)
                            ])
                            .nice()
                            .range([height + margin.top, margin.top]);

                        const xAxis = d3.axisBottom(x)
                            .tickValues(d3.range(0, data.length, Math.ceil(data.length / 10)))
                            .tickFormat(i => {
                                const date = new Date(data[i].datetime.replace(" ", "T"));
                                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            });

                        const yAxis = d3.axisLeft(y);

                        svg.append("g")
                            .attr("transform", \`translate(0,\${height + margin.top})\`)
                            .call(xAxis)
                            .selectAll("text")
                            .style("font-size", "12px");

                        svg.append("g")
                            .attr("transform", \`translate(\${margin.left},0)\`)
                            .call(yAxis)
                            .selectAll("text")
                            .style("font-size", "12px");

                        const g = svg.append("g");

                        // Wick lines
                        g.selectAll("line")
                            .data(data)
                            .enter().append("line")
                            .attr("x1", (_, i) => x(i) + x.bandwidth() / 2)
                            .attr("x2", (_, i) => x(i) + x.bandwidth() / 2)
                            .attr("y1", d => y(d.high))
                            .attr("y2", d => y(d.low))
                            .attr("stroke", "black");

                        // Candle bodies
                        g.selectAll("rect")
                            .data(data)
                            .enter().append("rect")
                            .attr("x", (_, i) => x(i))
                            .attr("y", d => y(Math.max(d.open, d.close)))
                            .attr("height", d => Math.abs(y(d.open) - y(d.close)))
                            .attr("width", x.bandwidth())
                            .attr("fill", d => d.open > d.close ? "red" : "green");

                        const smaLine = d3.line()
                            .defined(d => indexMap.has(d.datetime))
                            .x(d => {
                                const index = indexMap.get(d.datetime);
                                return x(index) + x.bandwidth() / 2;
                            })
                            .y(d => y(d.value));

                        g.append("path")
                            .datum(smaData1)
                            .attr("fill", "none")
                            .attr("stroke", "blue")
                            .attr("stroke-width", 2)
                            .attr("d", smaLine);

                        g.append("path")
                            .datum(smaData2)
                            .attr("fill", "none")
                            .attr("stroke", "black")
                            .attr("stroke-width", 2)
                            .attr("d", smaLine);
                        
                        g.append("path")
                            .datum(smaData3)
                            .attr("fill", "none")
                            .attr("stroke", "red")
                            .attr("stroke-width", 2)
                            .attr("d", smaLine);

                        // Session highlight
                        const groupedByDate = {};
                        data.forEach((d, i) => {
                            const dt = new Date(d.datetime.replace(" ", "T"));
                            const dateKey = dt.toISOString().split('T')[0];
                            if (!groupedByDate[dateKey]) {
                                groupedByDate[dateKey] = [];
                            }
                            groupedByDate[dateKey].push({ ...d, index: i });
                        });

                        sessionRanges.forEach(({ name, start, end, color }) => {
                            Object.values(groupedByDate).forEach(dayData => {
                                const sessionIndices = dayData.map(d => {
                                    const dt = new Date(d.datetime.replace(" ", "T"));
                                    const timeStr = dt.toTimeString().slice(0, 5);

                                    const isInSession = (
                                        (start < end && timeStr >= start && timeStr < end) ||
                                        (start > end && (timeStr >= start || timeStr < end))
                                    );

                                    return isInSession ? d.index : null;
                                }).filter(i => i !== null);

                                if (sessionIndices.length > 0) {
                                    const xStart = x(sessionIndices[0]);
                                    const xEnd = x(sessionIndices[sessionIndices.length - 1]) + x.bandwidth();

                                    g.append("rect")
                                        .attr("x", xStart)
                                        .attr("y", margin.top)
                                        .attr("width", xEnd - xStart)
                                        .attr("height", height)
                                        .attr("fill", color)
                                        .attr("opacity", 0.3);
                                }
                            });
                        });

                        Object.entries(groupedByDate).forEach(([dateStr, dayData]) => {
                            const dateObj = new Date(dateStr);
                            const dayOfWeek = dateObj.getDay();

                            if (dayOfWeek === 0 || dayOfWeek === 6) return;

                            const firstIndex = dayData[0].index;
                            const lastIndex = dayData[dayData.length - 1].index;
                            const xStart = x(firstIndex);
                            const xEnd = x(lastIndex) + x.bandwidth();
                            const xCenter = xStart + (xEnd - xStart) / 2;

                            g.append("text")
                                .attr("x", xCenter)
                                .attr("y", 20)
                                .attr("text-anchor", "middle")
                                .attr("fill", "#444")
                                .style("font-size", "14px")
                                .style("font-weight", "bold")
                                .text(dateStr);
                        });

                        // Trades rendering (БЕЗ ИЗМЕНЕНИЙ)
                        trades.forEach(trade => {
                            const entryIndex = indexMap.get(trade.entryTime);
                            const exitIndex = indexMap.get(trade.exitTime);

                            if (entryIndex === undefined || exitIndex === undefined) return;

                            const xStart = x(entryIndex);
                            const xEnd = x(exitIndex) + x.bandwidth();
                            const rectWidth = xEnd - xStart;

                            const entryPrice = trade.entryPriceWithSpread;
                            const exitPrice = trade.exitPriceWithSpread;
                            const stopLoss = trade.stopLoss;
                            const takeProfit = trade.takeProfit;

                            const isProfit = trade.result === "TAKE";

                            const yEntry = y(entryPrice);
                            const yExit = y(exitPrice);

                            let yTop = Math.min(yEntry, yExit);
                            let yBottom = Math.max(yEntry, yExit);

                            const hasSL = typeof stopLoss === "number";
                            const hasTP = typeof takeProfit === "number";

                            if (hasSL) {
                                const ySL = y(stopLoss);
                                yTop = Math.min(yTop, ySL);
                                yBottom = Math.max(yBottom, ySL);
                            }

                            if (hasTP) {
                                const yTP = y(takeProfit);
                                yTop = Math.min(yTop, yTP);
                                yBottom = Math.max(yBottom, yTP);
                            }

                            g.append("rect")
                                .attr("x", xStart)
                                .attr("y", yTop)
                                .attr("width", rectWidth)
                                .attr("height", yBottom - yTop)
                                .attr("fill", "none")
                                .attr("stroke", isProfit ? "green" : "red")
                                .attr("stroke-width", 1);

                            if (hasTP) {
                                g.append("rect")
                                    .attr("x", xStart)
                                    .attr("y", Math.min(yEntry, y(takeProfit)))
                                    .attr("width", rectWidth)
                                    .attr("height", Math.abs(yEntry - y(takeProfit)))
                                    .attr("fill", "rgba(0,255,0,0.2)");
                            }

                            if (hasSL) {
                                g.append("rect")
                                    .attr("x", xStart)
                                    .attr("y", Math.min(yEntry, y(stopLoss)))
                                    .attr("width", rectWidth)
                                    .attr("height", Math.abs(yEntry - y(stopLoss)))
                                    .attr("fill", "rgba(255,0,0,0.2)");
                            }

                            g.append("line")
                                .attr("x1", x(entryIndex) + x.bandwidth() / 2)
                                .attr("y1", yEntry)
                                .attr("x2", x(exitIndex) + x.bandwidth() / 2)
                                .attr("y2", yExit)
                                .attr("stroke", "black")
                                .attr("stroke-width", 2)
                                .attr("stroke-dasharray", "4 2");

                            g.append("text")
                                .attr("x", xStart + rectWidth / 2)
                                .attr("y", yTop - 5)
                                .attr("text-anchor", "middle")
                                .attr("fill", trade.direction === "LONG" ? "green" : "red")
                                .style("font-size", "12px")
                                .style("font-weight", "bold")
                                .text(trade.direction);

                            if (hasSL && hasTP) {
                                const rr = (Math.abs(takeProfit - entryPrice) / Math.abs(entryPrice - stopLoss)).toFixed(2);
                                const rrLabel = \`1 : \${parseFloat(rr)}\`;
                                const centerY = (yTop + yBottom) / 2;

                                g.append("text")
                                    .attr("x", xStart + rectWidth / 2)
                                    .attr("y", centerY)
                                    .attr("text-anchor", "middle")
                                    .attr("alignment-baseline", "middle")
                                    .attr("fill", "black")
                                    .style("font-size", "14px")
                                    .style("font-weight", "bold")
                                    .text(rrLabel);
                            }

                            // ➕ ПЛАНОВЫЕ ЛИНИИ
                            g.append("line")
                                .attr("x1", xStart)
                                .attr("x2", xEnd)
                                .attr("y1", y(trade.entryPrice))
                                .attr("y2", y(trade.entryPrice))
                                .attr("stroke", "blue")
                                .attr("stroke-width", 1)
                                .attr("stroke-dasharray", "3 3")
                                .attr("opacity", 0.7);

                            if (hasTP) {
                                g.append("line")
                                    .attr("x1", xStart)
                                    .attr("x2", xEnd)
                                    .attr("y1", y(trade.takeProfit))
                                    .attr("y2", y(trade.takeProfit))
                                    .attr("stroke", "green")
                                    .attr("stroke-width", 1)
                                    .attr("stroke-dasharray", "6 3")
                                    .attr("opacity", 0.6);
                            }

                            if (hasSL) {
                                g.append("line")
                                    .attr("x1", xStart)
                                    .attr("x2", xEnd)
                                    .attr("y1", y(trade.stopLoss))
                                    .attr("y2", y(trade.stopLoss))
                                    .attr("stroke", "red")
                                    .attr("stroke-width", 1)
                                    .attr("stroke-dasharray", "6 3")
                                    .attr("opacity", 0.6);
                            }
                                    // 🔥 ЛИНИЯ ЛИКВИДНОСТИ → ВХОД
                            if (trade.liquidityLevel) {

                                const liquidityIndex = indexMap.get(trade.liquidityLevel.time);

                                if (liquidityIndex !== undefined) {

                                    const x1 = x(liquidityIndex) + x.bandwidth() / 2;
                                    const y1 = y(trade.liquidityLevel.price);

                                    const x2 = x(entryIndex) + x.bandwidth() / 2;
                                    const y2 = y(trade.liquidityLevel.price);

                                    g.append("line")
                                        .attr("x1", x1)
                                        .attr("y1", y1)
                                        .attr("x2", x2)
                                        .attr("y2", y2)
                                        .attr("stroke", "purple")
                                        .attr("stroke-width", 2)
                                        .attr("stroke-dasharray", "2 2")
                                        .attr("opacity", 0.9);
                                }
                            }
                            // 🟡 IMBALANCE ZONE
                            if (trade.imbalanceLevel) {

                                const imbalanceIndex = indexMap.get(trade.imbalanceLevel.time);

                                if (imbalanceIndex !== undefined) {

                                    const xStartImb = x(imbalanceIndex);
                                    const xEndImb = x(entryIndex) + x.bandwidth();

                                    const yTopImb = y(trade.imbalanceLevel.high);
                                    const yBottomImb = y(trade.imbalanceLevel.low);

                                    const height = Math.abs(yBottomImb - yTopImb);
                                    const yRect = Math.min(yTopImb, yBottomImb);

                                    // 🔥 ЗОНА IMBALANCE
                                    g.append("rect")
                                        .attr("x", xStartImb)
                                        .attr("y", yRect)
                                        .attr("width", xEndImb - xStartImb)
                                        .attr("height", height)
                                        .attr("fill", "rgba(255, 165, 0, 0.2)") // оранжевый
                                        .attr("stroke", "orange")
                                        .attr("stroke-width", 1)
                                        .attr("opacity", 0.8);

                                    // 🔸 MIDLINE (50% imbalance)
                                    const mid = (trade.imbalanceLevel.high + trade.imbalanceLevel.low) / 2;

                                    g.append("line")
                                        .attr("x1", xStartImb)
                                        .attr("x2", xEndImb)
                                        .attr("y1", y(mid))
                                        .attr("y2", y(mid))
                                        .attr("stroke", "orange")
                                        .attr("stroke-width", 1)
                                        .attr("stroke-dasharray", "4 2")
                                        .attr("opacity", 0.7);

                                    // 🏷 LABEL
                                    g.append("text")
                                        .attr("x", xStartImb + 5)
                                        .attr("y", yRect - 3)
                                        .attr("fill", "orange")
                                        .style("font-size", "10px")
                                        .text("IMB");
                                }
                            }

                            // 🟦 RANGE ZONE
                            if (trade.range) {

                                const fromIndex = indexMap.get(trade.range.fromTime);
                                const toIndex = indexMap.get(trade.range.toTime);

                                if (fromIndex !== undefined && toIndex !== undefined) {

                                    const xStartRange = x(fromIndex);
                                    const xEndRange = x(toIndex) + x.bandwidth();

                                    const yTopRange = y(trade.range.high);
                                    const yBottomRange = y(trade.range.low);

                                    const height = Math.abs(yBottomRange - yTopRange);
                                    const yRect = Math.min(yTopRange, yBottomRange);

                                    // 🔥 САМА ЗОНА RANGE
                                    g.append("rect")
                                        .attr("x", xStartRange)
                                        .attr("y", yRect)
                                        .attr("width", xEndRange - xStartRange)
                                        .attr("height", height)
                                        .attr("fill", "rgba(0, 150, 255, 0.1)") // голубой полупрозрачный
                                        .attr("stroke", "rgba(0, 150, 255, 0.6)")
                                        .attr("stroke-width", 1)
                                        .attr("stroke-dasharray", "3 3")
                                        .attr("opacity", 0.7);

                                    // 🔸 MID (по желанию, но очень полезно)
                                    const mid = (trade.range.high + trade.range.low) / 2;

                                    g.append("line")
                                        .attr("x1", xStartRange)
                                        .attr("x2", xEndRange)
                                        .attr("y1", y(mid))
                                        .attr("y2", y(mid))
                                        .attr("stroke", "rgba(0, 150, 255, 0.8)")
                                        .attr("stroke-width", 1)
                                        .attr("stroke-dasharray", "4 2")
                                        .attr("opacity", 0.6);

                                    // 🏷 LABEL
                                    g.append("text")
                                        .attr("x", xStartRange + 5)
                                        .attr("y", yRect - 3)
                                        .attr("fill", "rgba(0, 150, 255, 0.9)")
                                        .style("font-size", "10px")
                                        .text("RANGE");
                                }
                            }
                                                                
                        });

                    </script>
                </body>
                </html>
            `;

            fs.writeFileSync('./candlestick_chart.html', html);
            console.log('✅ Всё работает: и агрегация, и сделки');
        });
}

module.exports = generateHtml;