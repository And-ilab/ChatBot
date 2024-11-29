// Функция для отображения графика
function renderChart(ctx, type, data, options) {
    if (window.chart) {
        window.chart.destroy();
    }

    window.chart = new Chart(ctx, {
        type: type,
        data: data,
        options: options
    });
}

// График активности пользователей
document
    .getElementById("btn-users-activity")
    .addEventListener("click", async function () {
        try {
            const response = await fetch("/api/user-activity/");
            const data = await response.json();

            const labels = data.map((item) => item.login_date);
            const values = data.map((item) => item.count);

            document.getElementById("chart-container").style.display = "block";
            document.getElementById("messagesChart").style.display = "none";
            document.getElementById("userActivityChart").style.display = "block";

            const ctx = document
                .getElementById("userActivityChart")
                .getContext("2d");

            const chartData = {
                labels: labels,
                datasets: [
                    {
                        label: "Активность пользователей",
                        data: values,
                        backgroundColor: "rgba(75, 192, 192, 0.2)",
                        borderColor: "rgba(75, 192, 192, 1)",
                        borderWidth: 1
                    }
                ]
            };

            const options = {
                scales: {
                    y: { beginAtZero: true }
                }
            };

            renderChart(ctx, "bar", chartData, options);
        } catch (error) {
            console.error("Ошибка загрузки данных:", error);
        }
    });

// График по количеству сообщений
document
    .getElementById("btn-messages-count")
    .addEventListener("click", async function () {
        try {
            const response = await fetch("/api/messages-count-data/");
            const data = await response.json();

            document.getElementById("chart-container").style.display = "block";
            document.getElementById("userActivityChart").style.display = "none";
            document.getElementById("messagesChart").style.display = "block";

            const ctx = document
                .getElementById("messagesChart")
                .getContext("2d");

            const dates = data.map((item) => item.date);
            const userMessages = data.map((item) => item.user);
            const botMessages = data.map((item) => item.bot);

            const chartData = {
                labels: dates,
                datasets: [
                    {
                        label: "Пользователь",
                        data: userMessages,
                        borderColor: "rgba(75, 192, 192, 1)",
                        fill: false
                    },
                    {
                        label: "Бот",
                        data: botMessages,
                        borderColor: "rgba(153, 102, 255, 1)",
                        fill: false
                    }
                ]
            };

            const options = {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { title: { display: true, text: "Дата" } },
                    y: { title: { display: true, text: "Количество сообщений" } }
                }
            };

            renderChart(ctx, "line", chartData, options);
        } catch (error) {
            console.error("Ошибка при получении данных:", error);
        }
    });

// График частоты отказов
document
    .getElementById("btn-ignored")
    .addEventListener("click", async function () {
        try {
            const response = await fetch("/api/daily-messages/");
            const data = await response.json();

            const labels = data.map((item) => item.date);
            const values = data.map((item) => item.count);

            document.getElementById("chart-container").style.display = "block";
            document.getElementById("messagesChart").style.display = "none";
            document.getElementById("userActivityChart").style.display = "none";
            document.getElementById("ignoredFrequencyChart").style.display = "block";

            const ctx = document
                .getElementById("ignoredFrequencyChart")
                .getContext("2d");

            const chartData = {
                labels: labels,
                datasets: [
                    {
                        label: "Количество сообщений по дням",
                        data: values,
                        backgroundColor: "rgba(255, 99, 132, 0.2)",
                        borderColor: "rgba(255, 99, 132, 1)",
                        borderWidth: 1
                    }
                ]
            };

            const options = {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: "Количество сообщений" }
                    },
                    x: { title: { display: true, text: "Дата" } }
                }
            };

            renderChart(ctx, "bar", chartData, options);
        } catch (error) {
            console.error("Ошибка загрузки данных:", error);
        }
    });
