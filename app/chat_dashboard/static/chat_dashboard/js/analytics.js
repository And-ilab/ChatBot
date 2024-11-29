import { getCSRFToken, fetchData } from '/static/js/utils.js';

// Универсальная функция для отображения графика
function renderChart(ctx, type, data, options) {
    if (window.chart) {
        window.chart.destroy(); // Удаляем старый график перед созданием нового
    }
    window.chart = new Chart(ctx, { type, data, options });
}

// Функция для обработки графика
async function handleChart(buttonId, apiUrl, chartId, processData, chartType = "bar", chartOptions = {}) {
    document.getElementById(buttonId).addEventListener("click", async () => {
        try {
            const data = await fetchData(apiUrl, {
                headers: { "X-CSRFToken": getCSRFToken() },
            });

            // Обработка данных для графика
            const { labels, datasets } = processData(data);

            // Показ и скрытие соответствующих графиков
            const chartContainer = document.getElementById("chart-container");
            const charts = document.querySelectorAll(".chart");
            chartContainer.style.display = "block";
            charts.forEach((chart) => (chart.style.display = "none"));
            const ctx = document.getElementById(chartId).getContext("2d");
            document.getElementById(chartId).style.display = "block";

            // Рисуем график
            renderChart(ctx, chartType, { labels, datasets }, chartOptions);
        } catch (error) {
            console.error(`Ошибка загрузки данных для ${chartId}:`, error);
        }
    });
}

// Обработка данных для графика активности пользователей
handleChart(
    "btn-users-activity",
    "/api/user-activity/",
    "userActivityChart",
    (data) => ({
        labels: data.map((item) => item.login_date),
        datasets: [
            {
                label: "Активность пользователей",
                data: data.map((item) => item.count),
                backgroundColor: "rgba(75, 192, 192, 0.2)",
                borderColor: "rgba(75, 192, 192, 1)",
                borderWidth: 1,
            },
        ],
    }),
    "bar",
    { scales: { y: { beginAtZero: true } } }
);

// Обработка данных для графика количества сообщений
handleChart(
    "btn-messages-count",
    "/api/messages-count-data/",
    "messagesChart",
    (data) => ({
        labels: data.map((item) => item.date),
        datasets: [
            {
                label: "Пользователь",
                data: data.map((item) => item.user),
                borderColor: "rgba(75, 192, 192, 1)",
                fill: false,
            },
            {
                label: "Бот",
                data: data.map((item) => item.bot),
                borderColor: "rgba(153, 102, 255, 1)",
                fill: false,
            },
        ],
    }),
    "line",
    {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: { title: { display: true, text: "Дата" } },
            y: { title: { display: true, text: "Количество сообщений" } },
        },
    }
);

// Обработка данных для графика частоты отказов
handleChart(
    "btn-ignored",
    "/api/daily-messages/",
    "ignoredFrequencyChart",
    (data) => ({
        labels: data.map((item) => item.date),
        datasets: [
            {
                label: "Количество сообщений по дням",
                data: data.map((item) => item.count),
                backgroundColor: "rgba(255, 99, 132, 0.2)",
                borderColor: "rgba(255, 99, 132, 1)",
                borderWidth: 1,
            },
        ],
    }),
    "bar",
    {
        responsive: true,
        scales: {
            y: {
                beginAtZero: true,
                title: { display: true, text: "Количество сообщений" },
            },
            x: {
                title: { display: true, text: "Дата" },
            },
        },
    }
);
