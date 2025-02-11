// Функция для получения данных
async function fetchUserActivityData() {
    try {
        const response = await fetch('/api/session-data/');
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

function processUserActivityData(data) {
    let start, end;

    if (selectedDate) {
        const selected = new Date(selectedDate);
        start = new Date(selected);
        end = new Date(selected);
    } else if (selectedMonth) {
        const selected = new Date(selectedMonth);
        start = new Date(selected.getFullYear(), selected.getMonth(), 1);
        end = new Date(selected.getFullYear(), selected.getMonth() + 1, 0);
    } else {
        ({ start, end } = getDateRange());
    }

    const allDates = generateDateRange(start, end);
    const groupedData = {};

    allDates.forEach(date => {
        const key = formatDate(date);
        groupedData[key] = new Set();
    });

    data.forEach(({ created_at, user }) => {
        const dateKey = formatDate(new Date(created_at));
        if (groupedData[dateKey]) {
            groupedData[dateKey].add(user);
        }
    });

    for (const date in groupedData) {
        groupedData[date] = groupedData[date].size;
    }

    currentExportData = groupedData;
    return groupedData;
}



function renderUserActivityChart(data, chartType) {
    const groupedData = processUserActivityData(data);
    const labels = Object.keys(groupedData).sort(); // Сортируем по датам
    const userActivityData = labels.map(date => groupedData[date]);

    // Фильтруем данные, оставляя только те, где количество пользователей > 0
    const filteredLabels = labels.filter((date, index) => userActivityData[index] > 0);
    const filteredData = filteredLabels.map(date => groupedData[date]);

    // Генерация цветов только для отфильтрованных данных
    const backgroundColors = filteredLabels.map(() => getRandomColor());

    // Создаем новый canvas для отображения графика
    canvasContainer.innerHTML = '<canvas id="userActivityChart"></canvas>';
    const ctx = document.getElementById("userActivityChart").getContext("2d");

    if (chartInstance) {
        chartInstance.destroy(); // Уничтожаем предыдущий график, если он был
    }

    // Отображаем график, если выбран столбчатый тип
    if (chartType === "bar") {
        chartInstance = new Chart(ctx, {
            type: "bar",
            data: {
                labels: labels,
                datasets: [{
                    label: "Активность пользователей",
                    data: userActivityData,
                    backgroundColor: "#4CAF50",
                    borderRadius: 5,
                    barPercentage: 0.6,
                    categoryPercentage: 0.5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: { display: true, text: "Дата" }
                    },
                    y: {
                        title: { display: true, text: "Количество пользователей" },
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,  // шаг между метками на оси
                            precision: 0, // убирает дробные значения
                            callback: function(value) {
                                return value % 1 === 0 ? value : '';  // Оставляем только целые числа
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top'
                    }
                }
            }
        });
    } else if (chartType === "pie") {
        chartInstance = new Chart(ctx, {
            type: "pie",
            data: {
                labels: filteredLabels, // Используем отфильтрованные метки
                datasets: [{
                    label: "Активность пользователей",
                    data: filteredData, // Используем отфильтрованные данные
                    backgroundColor: backgroundColors  // Используем цвета только для отфильтрованных данных
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            filter: function(item, chart) {
                                // Показываем только те элементы легенды, которые соответствуют данным > 0
                                return filteredData[item.index] > 0;
                            }
                        }
                    }
                }
            }
        });
    }
}

function renderUserActivityTable(data) {
    const groupedData = processUserActivityData(data);
    const dates = Object.keys(groupedData).sort();

    const tableHTML = `
        <table class="analytics-table">
            <thead>
                <tr>
                    <th>Дата</th>
                    <th>Количество пользователей</th>
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
