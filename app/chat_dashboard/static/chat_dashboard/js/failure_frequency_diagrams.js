// Функция для получения данных
async function fetchFailureFrequencyData() {
    try {
        const response = await fetch('/api/refused-data/');
        if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Произошла ошибка при получении данных:', error.message);
        return [];
    }
}

function processFailureFrequencyData(data) {
    const { start, end } = getDateRange();
    const allDates = generateDateRange(start, end);
    const groupedData = {};

    allDates.forEach(date => {
        const key = formatDate(date);
        groupedData[key] = 0;
    });

    data.forEach(({ created_at }) => {
        const dateKey = formatDate(new Date(created_at));
        if (groupedData[dateKey] !== undefined) {
            groupedData[dateKey]++;
        }
    });

    return groupedData;
}


function renderFailureFrequencyChart(data, chartType) {
    const groupedData = processFailureFrequencyData(data);
    const labels = Object.keys(groupedData).sort();
    const failureRates = labels.map(date => groupedData[date]);

    // Фильтрация данных (убираем нулевые значения)
    const filteredLabels = labels.filter((date, index) => failureRates[index] > 0);
    const filteredData = filteredLabels.map(date => groupedData[date]);

    // Генерация цветов
    const backgroundColors = filteredLabels.map(() => getRandomColor());

    canvasContainer.innerHTML = '<canvas id="failureRateChart"></canvas>';
    const ctx = document.getElementById("failureRateChart").getContext("2d");

    if (chartInstance) {
        chartInstance.destroy();
    }

    if (chartType === "bar") {
        chartInstance = new Chart(ctx, {
            type: "bar",
            data: {
                labels: labels,
                datasets: [
                    {
                        label: "Частота отказов",
                        data: failureRates,
                        backgroundColor: "#FF9800",
                        borderRadius: 5,
                        barPercentage: 0.6,
                        categoryPercentage: 0.5
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { title: { display: true, text: "Дата" } },
                    y: {
                        title: { display: true, text: "Количество отказов" },
                        beginAtZero: true,
                        ticks: { stepSize: 1, precision: 0 }
                    }
                },
                plugins: {
                    legend: {
                        display: true, // Включаем отображение легенды
                        position: 'top',
                        labels: {
                            font: { size: 14 },
                            boxWidth: 20, // Размер цветных квадратиков
                            padding: 15
                        }
                    }
                }
            }
        });
    } else if (chartType === "pie") {
        chartInstance = new Chart(ctx, {
            type: "pie",
            data: {
                labels: filteredLabels,
                datasets: [{
                    label: "Частота отказов",
                    data: filteredData,
                    backgroundColor: backgroundColors
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true, // Обязательно включаем легенду
                        position: 'top',
                        labels: {
                            font: { size: 14 },
                            boxWidth: 20,
                            padding: 15
                        }
                    }
                }
            }
        });
    }
}



function renderFailureFrequencyTable(data) {
    const groupedData = processFailureFrequencyData(data);
    const dates = Object.keys(groupedData).sort();

    const tableHTML = `
        <table class="analytics-table">
            <thead>
                <tr>
                    <th>Дата</th>
                    <th>Количество отказов</th>
                </tr>
            </thead>
            <tbody>
                ${dates.map(date => `
                    <tr>
                        <td>${date}</td>
                        <td>${groupedData[date]}</td>
                    </tr>
                `).join('')}
                <tr class="total-row">
                    <td>Итого</td>
                    <td>${dates.reduce((sum, date) => sum + groupedData[date], 0)}</td>
                </tr>
            </tbody>
        </table>
    `;

    canvasContainer.innerHTML = tableHTML;
}