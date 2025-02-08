async function fetchPopularRequestsData() {
    try {
        const response = await fetch('/api/popular-requests/');
        if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Ошибка при получении данных:', error.message);
        return [];
    }
}

// Группировка данных по датам и типам запросов
function processPopularRequestsData(data) {
    const { start, end } = getDateRange();
    const allDates = generateDateRange(start, end);
    const groupedData = {};

    // Уникальные типы запросов
    const requestTypes = [
        "Организационно-кадровая работа",
        "Оказание материальной помощи и оплата труда",
        "Социальные вопросы: страхование, соцпакет, назначение пенсии",
        "Обучение, тестирование, практика",
        "Вопросы для психологов",
        "Образцы заявлений"
    ];

    // Заполняем объект нулями
    allDates.forEach(date => {
        const key = formatDate(date);
        groupedData[key] = {};
        requestTypes.forEach(type => groupedData[key][type] = 0);
    });

    // Обрабатываем реальные данные
    data.forEach(({ created_at, type }) => {
        const dateKey = formatDate(new Date(created_at));
        if (groupedData[dateKey] && groupedData[dateKey][type] !== undefined) {
            groupedData[dateKey][type]++;
        }
    });

    return { groupedData, requestTypes };
}

// Рендер диаграммы по дням
function renderPopularRequestsChart(data, chartType) {
    const { groupedData, requestTypes } = processPopularRequestsData(data);
    const labels = Object.keys(groupedData).sort();

    const datasets = requestTypes.map(type => ({
        label: type,
        data: labels.map(date => groupedData[date][type]),
        backgroundColor: getRandomColor(),
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
                    backgroundColor: requestTypes.map(() => getRandomColor())
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