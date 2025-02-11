// Функция для получения данных
async function fetchMessagesCountData() {
    try {
        const response = await fetch('/api/messages-count-data/');
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

function processMessagesCountChartData(data) {
    let start, end;

    if (selectedDate) {
        // Если выбрана конкретная дата, используем её
        const selected = new Date(selectedDate);
        start = new Date(selected);
        end = new Date(selected);
    } else if (selectedMonth) {
        // Если выбран месяц, используем его
        const selected = new Date(selectedMonth);
        start = new Date(selected.getFullYear(), selected.getMonth(), 1);
        end = new Date(selected.getFullYear(), selected.getMonth() + 1, 0);
    } else {
        // Если не выбрана дата или месяц, используем текущий месяц
        ({ start, end } = getDateRange());
    }

    const allDates = generateDateRange(start, end);
    const groupedData = {};

    // Инициализируем все даты с нулями в правильном формате
    allDates.forEach(date => {
        const key = formatDate(date);
        groupedData[key] = { user: 0, bot: 0 };
    });

    // Заполняем данными из API, приводя дату к нужному формату
    data.forEach(({ created_at, user, bot }) => {
        const formattedDate = formatDate(new Date(created_at)); // Преобразуем в форматированную дату
        if (groupedData[formattedDate]) {
            groupedData[formattedDate] = { user, bot };
        }
    });

    return groupedData;
}


function renderMessagesCountChart(data, chartType) {
    const groupedData = processMessagesCountChartData(data);
    const labels = Object.keys(groupedData).sort();
    const userMessages = labels.map(date => groupedData[date].user);
    const botMessages = labels.map(date => groupedData[date].bot);

    canvasContainer.innerHTML = '<canvas id="messagesChart"></canvas>';
    const ctx = document.getElementById("messagesChart").getContext("2d");

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
                        label: "Пользователи",
                        data: userMessages,
                        backgroundColor: "#F44336",
                        borderRadius: 5,
                        barPercentage: 0.6,
                        categoryPercentage: 0.5
                    },
                    {
                        label: "Бот",
                        data: botMessages,
                        backgroundColor: "#4CAF50",
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
                    x: {
                        title: { display: true, text: "Дата" }
                    },
                    y: {
                        title: { display: true, text: "Количество сообщений" },
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            precision: 0
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
                labels: ["Пользователи", "Бот"],
                datasets: [
                    {
                        label: "Количество сообщений",
                        data: [
                            userMessages.reduce((a, b) => a + b, 0),
                            botMessages.reduce((a, b) => a + b, 0)
                        ],
                        backgroundColor: ["#F44336", "#4CAF50"]
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                }
            }
        });
    }
}

function renderMessagesCountTable(data) {
    const groupedData = processMessagesCountChartData(data);
    const dates = Object.keys(groupedData).sort();

    const tableHTML = `
        <table class="analytics-table">
            <thead>
                <tr>
                    <th>Дата</th>
                    <th>Пользователи</th>
                    <th>Бот</th>
                    <th>Всего</th>
                </tr>
            </thead>
            <tbody>
                ${dates.map(date => `
                    <tr>
                        <td>${date}</td>
                        <td>${groupedData[date].user}</td>
                        <td>${groupedData[date].bot}</td>
                        <td>${groupedData[date].user + groupedData[date].bot}</td>
                    </tr>
                `).join('')}
                <tr class="total-row">
                    <td>Итого</td>
                    <td>${dates.reduce((sum, date) => sum + groupedData[date].user, 0)}</td>
                    <td>${dates.reduce((sum, date) => sum + groupedData[date].bot, 0)}</td>
                    <td>${dates.reduce((sum, date) => sum + groupedData[date].user + groupedData[date].bot, 0)}</td>
                </tr>
            </tbody>
        </table>
    `;

    canvasContainer.innerHTML = tableHTML;
}
