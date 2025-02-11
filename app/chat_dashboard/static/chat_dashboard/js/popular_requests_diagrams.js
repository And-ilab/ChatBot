async function fetchPopularRequestsData() {
    try {
        const response = await fetch('/api/popular-requests/');
        if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status}`);
        }
        data = await response.json();
        currentChartData = data;
        return data;
    } catch (error) {
        console.error('Ошибка при получении данных:', error.message);
        return [];
    }
}

function processPopularRequestsData(data) {
    let start,
        end;

    // Определяєм початку та кiнця періоду
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

    // Список типов запросов
    const requestTypes = [
        "Организационно-кадровая работа",
        "Оказание материальной помощи и оплаты труда",
        "Социальные вопросы: страхование, социальный пакет, пенсия",
        "Обучение, тестирование, практика",
        "Вопросы для психологов",
        "Образцы заявлений"
    ];

    // Ініціалізація даних
    allDates.forEach(date => {
        const key = formatDate(date);
        groupedData[key] = {};

        requestTypes.forEach(type => {
            groupedData[key][type] = 0;
        });
    });

    // Обробка даних
    data.forEach(({ created_at, type }) => {
        const dateKey = formatDate(new Date(created_at));
        groupedData[dateKey][type]++;
    });

    currentExportData = groupedData;
    return {
        groupedData,
        requestTypes
    };
}


// Объект с фиксированными цветами для каждого типа запроса
const requestTypeColors = {
    "Организационно-кадровая работа": "rgba(255, 99, 132, 0.6)",
    "Оказание материальной помощи и оплаты труда": "rgba(54, 162, 235, 0.6)",
    "Социальные вопросы: страхование, социальный пакет, пенсия": "rgba(255, 206, 86, 0.6)",
    "Обучение, тестирование, практика": "rgba(75, 192, 192, 0.6)",
    "Вопросы для психологов": "rgba(153, 102, 255, 0.6)",
    "Образцы заявлений": "rgba(255, 159, 64, 0.6)"
};

// Функция для получения цвета по типу запроса
function getColorForRequestType(type) {
    return requestTypeColors[type] || "rgba(0, 0, 0, 0.6)"; // Возвращаем черный цвет, если тип не найден
}

// Рендер диаграммы по дням
function renderPopularRequestsChart(data, chartType) {
    const { groupedData, requestTypes } = processPopularRequestsData(data);
    const labels = Object.keys(groupedData).sort();

    const datasets = requestTypes.map(type => ({
        label: type,
        data: labels.map(date => groupedData[date][type]),
        backgroundColor: getColorForRequestType(type), // Используем фиксированный цвет
        borderRadius: 5,
        barPercentage: 0.6,
        categoryPercentage: 0.5
    }));

    canvasContainer.innerHTML = '<canvas id="popularRequestsChart"></canvas>';
    const ctx = document.getElementById("popularRequestsChart").getContext("2d");

    if (chartInstance) {
        chartInstance.destroy();
    }

    if (chartType === "bar") {
        chartInstance = new Chart(ctx, {
            type: "bar",
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { title: { display: true, text: "Дата" } },
                    y: { title: { display: true, text: "Количество запросов" }, beginAtZero: true }
                },
                plugins: { legend: { position: "top" } }
            }
        });
    } else if (chartType === "pie") {
        const totalCounts = requestTypes.map(type =>
            labels.reduce((sum, date) => sum + groupedData[date][type], 0)
        );

        chartInstance = new Chart(ctx, {
            type: "pie",
            data: {
                labels: requestTypes,
                datasets: [{
                    label: "Популярные запросы",
                    data: totalCounts,
                    backgroundColor: requestTypes.map(type => getColorForRequestType(type)) // Используем фиксированный цвет
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: "top" } }
            }
        });
    }
}

// Генерация таблицы
function renderPopularRequestsTable(data) {
    const { groupedData, requestTypes } = processPopularRequestsData(data);
    const dates = Object.keys(groupedData).sort();

    const tableHTML = `
        <table class="analytics-table">
            <thead>
                <tr>
                    <th>Дата</th>
                    ${requestTypes.map(type => `<th>${type}</th>`).join('')}
                    <th>Всего</th>
                </tr>
            </thead>
            <tbody>
                ${dates.map(date => `
                    <tr>
                        <td>${date}</td>
                        ${requestTypes.map(type => `<td>${groupedData[date][type]}</td>`).join('')}
                        <td>${requestTypes.reduce((sum, type) => sum + groupedData[date][type], 0)}</td>
                    </tr>
                `).join('')}
                <tr class="total-row">
                    <td>Итого</td>
                    ${requestTypes.map(type =>
                        `<td>${dates.reduce((sum, date) => sum + groupedData[date][type], 0)}</td>`
                    ).join('')}
                    <td>${dates.reduce((sum, date) =>
                        sum + requestTypes.reduce((s, type) => s + groupedData[date][type], 0)
                    , 0)}</td>
                </tr>
            </tbody>
        </table>
    `;

    canvasContainer.innerHTML = tableHTML;
}