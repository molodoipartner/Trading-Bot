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
                        const data = ${JSON.stringify(filteredData)};
                        const trades = ${JSON.stringify(trades)};
                        const sessionRanges = ${JSON.stringify(sessionRanges)};
                        const smaData1 = ${JSON.stringify(smaData1)};
                        const smaData2 = ${JSON.stringify(smaData2)};
                        const smaData3 = ${JSON.stringify(smaData3)};


                        const svg = d3.select("svg");
                        const margin = {top: 40, right: 20, bottom: 40, left: 80};
                        const width = +svg.attr("width") - margin.left - margin.right;
                        const height = +svg.attr("height") - margin.top - margin.bottom;

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
                            .defined(d => data.find(candle => candle.datetime === d.datetime)) // фильтрация по совпадающим временам
                            .x(d => {
                                const index = data.findIndex(c => c.datetime === d.datetime);
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
                                    const timeStr = dt.toTimeString().slice(0, 5); // "HH:MM"

                                    const isInSession = (
                                        (start < end && timeStr >= start && timeStr < end) ||
                                        (start > end && (timeStr >= start || timeStr < end)) // ночная сессия
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
                            const dayOfWeek = dateObj.getDay(); // 0 = воскресенье, 6 = суббота

                            if (dayOfWeek === 0 || dayOfWeek === 6) return; // Пропустить выходные

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



                        // Trades rendering (двухцветный прямоугольник и RR)
                        trades.forEach(trade => {
                            const entryIndex = data.findIndex(d => d.datetime === trade.entryTime);
                            const exitIndex = data.findIndex(d => d.datetime === trade.exitTime);

                            if (entryIndex === -1 || exitIndex === -1) return;

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

                            // Определяем верх и низ прямоугольника
                            let yTop = Math.min(yEntry, yExit);
                            let yBottom = Math.max(yEntry, yExit);

                            // Если есть и SL, и TP — уточняем границы
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

                            // 🔳 Обводка вокруг всей сделки
                            g.append("rect")
                                .attr("x", xStart)
                                .attr("y", yTop)
                                .attr("width", rectWidth)
                                .attr("height", yBottom - yTop)
                                .attr("fill", "none")
                                .attr("stroke", isProfit ? "green" : "red")
                                .attr("stroke-width", 1);

                            // 🌈 Заливка, если есть SL/TP
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

                            // ➖ Линия от entry до exit
                            g.append("line")
                                .attr("x1", x(entryIndex) + x.bandwidth() / 2)
                                .attr("y1", yEntry)
                                .attr("x2", x(exitIndex) + x.bandwidth() / 2)
                                .attr("y2", yExit)
                                .attr("stroke", "black")
                                .attr("stroke-width", 2)
                                .attr("stroke-dasharray", "4 2");

                            // 🏷️ Подпись типа сделки (LONG / SHORT)
                            g.append("text")
                                .attr("x", xStart + rectWidth / 2)
                                .attr("y", yTop - 5)
                                .attr("text-anchor", "middle")
                                .attr("fill", trade.direction === "LONG" ? "green" : "red")
                                .style("font-size", "12px")
                                .style("font-weight", "bold")
                                .text(trade.direction);

                            // 💬 RR-текст, только если SL и TP есть
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

                            // =====================================================
                            // ➕ ПЛАНОВЫЕ ЛИНИИ (БЕЗ СПРЕДА) — НОВЫЙ БЛОК
                            // =====================================================

                            // 🔵 Плановый ENTRY
                            g.append("line")
                                .attr("x1", xStart)
                                .attr("x2", xEnd)
                                .attr("y1", y(trade.entryPrice))
                                .attr("y2", y(trade.entryPrice))
                                .attr("stroke", "blue")
                                .attr("stroke-width", 1)
                                .attr("stroke-dasharray", "3 3")
                                .attr("opacity", 0.7);

                            // 🟩 Плановый TAKE PROFIT
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

                            // 🟥 Плановый STOP LOSS
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
                        });

                    


                    </script>
                </body>
                </html>
            `;

            fs.writeFileSync('./candlestick_chart.html', html);
            console.log('✅ График успешно создан: candlestick_chart.html');
        });
}

module.exports = generateHtml;
