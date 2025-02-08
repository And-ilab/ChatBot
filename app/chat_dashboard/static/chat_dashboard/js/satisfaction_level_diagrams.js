// Функция для получения данных
async function fetchSatisfactionData() {
    try {
        const response = await fetch('/api/feedbacks/');
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

function processSatisfactionChartData(data) {
    const { start, end } = getDateRange();
    const allDates = generateDateRange(start, end);
    const groupedData = {};

    allDates.forEach(date => {
        const key = formatDate(date);
        groupedData[key] = { likes: 0, dislikes: 0 };
    });

    data.forEach(({ created_at, message_type }) => {
        const dateKey = formatDate(new Date(created_at));
        if (groupedData[dateKey]) {
            message_type === 'like' ? groupedData[dateKey].likes++
                                   : groupedData[dateKey].dislikes++;
        }
    });

    return groupedData;
}

function renderSatisfactionChart(data, chartType) {
    const groupedData = processSatisfactionChartData(data);
    const labels = Object.keys(groupedData).sort();
    const likesData = labels.map(date => groupedData[date].likes);
    const dislikesData = labels.map(date => groupedData[date].dislikes);

    canvasContainer.innerHTML = '<canvas id="satisfactionChart"></canvas>';
    const ctx = document.getElementById("satisfactionChart").getContext("2d");

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
                        label: "Лайки",
                        data: likesData,
                        backgroundColor: "#4CAF50",
                        borderRadius: 5,
                        barPercentage: 0.6,
                        categoryPercentage: 0.5
                    },
                    {
                        label: "Дизлайки",
                        data: dislikesData,
                        backgroundColor: "#F44336",
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
                        title: { display: true, text: "Количество оценок" },
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
                labels: ["Лайки", "Дизлайки"],
                datasets: [
                    {
                        label: "Оценки",
                        data: [likesData.reduce((a, b) => a + b, 0), dislikesData.reduce((a, b) => a + b, 0)],
                        backgroundColor: ["#4CAF50", "#F44336"]
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

function renderSatisfactionTable(data) {
    const groupedData = processSatisfactionChartData(data);
    const dates = Object.keys(groupedData).sort();

    const tableHTML = `
        <table class="analytics-table">
            <thead>
                <tr>
                    <th>Дата</th>
                    <th>Лайки</th>
                    <th>Дизлайки</th>
                    <th>Всего</th>
                </tr>
            </thead>
            <tbody>
                ${dates.map(date => `
                    <tr>
                        <td>${date}</td>
                        <td>${groupedData[date].likes}</td>
                        <td>${groupedData[date].dislikes}</td>
                        <td>${groupedData[date].likes + groupedData[date].dislikes}</td>
                    </tr>
                `).join('')}
                <tr class="total-row">
                    <td>Итого</td>
                    <td>${dates.reduce((sum, date) => sum + groupedData[date].likes, 0)}</td>
                    <td>${dates.reduce((sum, date) => sum + groupedData[date].dislikes, 0)}</td>
                    <td>${dates.reduce((sum, date) => sum + groupedData[date].likes + groupedData[date].dislikes, 0)}</td>
                </tr>
            </tbody>
        </table>
    `;

    canvasContainer.innerHTML = tableHTML;
}