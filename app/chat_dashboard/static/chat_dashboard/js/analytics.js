document.addEventListener("DOMContentLoaded", function () {
    // Элементы
    const buttons = document.querySelectorAll(".sidebar-btn");

    const barChartButton = document.getElementById("btn-bar-chart");
    const pieChartButton = document.getElementById("btn-pie-chart");
    const tableButton = document.getElementById("btn-table");

    const satisfactionButton = document.getElementById("btn-satisfaction-level");
    const messagesCountButton = document.getElementById("btn-messages-count");
    const usersActivityButton = document.getElementById("btn-users-activity");
    const iteractionsFrequencyButton = document.getElementById("btn-iteractions-frequency");
    const failureFrequencyButton = document.getElementById("btn-failure-frequency");
    const popularRequestsButton = document.getElementById("btn-popular-requests");

    // Фильтр
    const filterItems = document.querySelectorAll('.filter-item');
    const monthPicker = document.querySelector('.month-picker');
    const datePicker = document.querySelector('.date-picker');

    // Обработчик выбора фильтра
    filterItems.forEach(item => {
        item.addEventListener('click', function () {
            const period = this.dataset.period;

            filterItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');

            if (period === 'custom-month') {
                datePicker.style.display = 'none';
                monthPicker.style.display = 'none';
                monthPicker.focus(); // Для появления выбора
            } else if (period === 'custom-date') {
                monthPicker.style.display = 'none';
                datePicker.style.display = 'none';
                datePicker.focus(); // Для появления выбора
            } else {
                monthPicker.style.display = 'none';
                datePicker.style.display = 'none';
                currentFilter.type = period;
                refreshData();
            }
        });
    });

    monthPicker.addEventListener('change', function(e) {
        const [year, month] = this.value.split('-');
        currentFilter = {
            type: 'custom-month',
            value: {
                start: new Date(year, month-1, 1),
                end: new Date(year, month, 0)
            }
        };
        refreshData();
    });

    datePicker.addEventListener('change', function(e) {
        currentFilter = {
            type: 'custom-date',
            value: {
                start: new Date(this.value),
                end: new Date(this.value)
            }
        };
        currentFilter.value.end.setHours(23, 59, 59, 999);
        refreshData();
    });

        function getActiveChartFunctions() {
        const activeButton = document.querySelector(".sidebar-btn.active");
        if (!activeButton) return {};

        const mapping = {
            "btn-satisfaction-level": [fetchSatisfactionData, renderSatisfactionChart, renderSatisfactionTable],
            "btn-messages-count": [fetchMessagesCountData, renderMessagesCountChart, renderMessagesCountTable],
            "btn-users-activity": [fetchUserActivityData, renderUserActivityChart, renderUserActivityTable],
//            "btn-iteractions-frequency": [fetchInteractionsFrequencyData, renderInteractionsFrequencyChart, renderInteractionsFrequencyTable],
            "btn-failure-frequency": [fetchFailureFrequencyData, renderFailureFrequencyChart, renderFailureFrequencyTable],
            "btn-popular-requests": [fetchPopularRequestsData, renderPopularRequestsChart, renderPopularRequestsTable]
        };

        return mapping[activeButton.id] || {};
    }

    function handleChartButtonClick(chartType) {
        const [fetchFunction, renderFunction, renderTable] = getActiveChartFunctions();
        if (!fetchFunction) return;

        fetchFunction().then(data => {
            const filteredData = filterData(data);
            if (chartType === "bar") {
                renderFunction(filteredData, "bar");
            } else if (chartType === "pie") {
                renderFunction(filteredData, "pie");
            } else if (chartType === "table") {
                renderTable(filteredData);
            }
        });

        setActiveChartButton(chartType === "bar" ? barChartButton : (chartType === "pie" ? pieChartButton : tableButton));
    }

    function refreshData() {
        const [fetchFunction, renderFunction, renderTable] = getActiveChartFunctions();
        if (!fetchFunction) return;

        fetchFunction().then(data => {
            const filteredData = filterData(data);

            if (chartInstance) {
                const isTable = canvasContainer.querySelector("table");
                if (isTable) {
                    renderTable(filteredData);
                } else {
                    const chartType = document.querySelector(".btn-group .active").id.replace("btn-", "");
                    renderFunction(filteredData, chartType === "bar-chart" ? "bar" : "pie");
                }
            }
        });
    }


    // Обновленная функция фильтрации
    function filterData(data) {
        const { start, end } = getDateRange();
        return data.filter(item => {
            const itemDate = new Date(item.created_at);
            return itemDate >= start && itemDate <= end;
        });
    }

    function setActiveChartButton(activeButton) {
        [barChartButton, pieChartButton, tableButton].forEach(btn => btn.classList.remove("active"));
        activeButton.classList.add("active");
    }

    buttons.forEach(button => {
        button.addEventListener("click", function () {
            buttons.forEach(btn => btn.classList.remove("active"));
            this.classList.add("active");

            if (this.id === "btn-satisfaction-level") {
                fetchSatisfactionData().then(data => {
                    renderSatisfactionChart(data, "bar");
                    setActiveChartButton(barChartButton);
                });
            } else if (this.id === "btn-messages-count") {
                fetchMessagesCountData().then(data => {
                    renderMessagesCountChart(data, "bar");
                    setActiveChartButton(barChartButton);
                });
            } else if (this.id === "btn-users-activity") {
                fetchUserActivityData().then(data => {
                    renderUserActivityChart(data, "bar");
                    setActiveChartButton(barChartButton);
                });
            } else if (this.id === "btn-failure-frequency") {
                fetchFailureFrequencyData().then(data => {
                    renderFailureFrequencyChart(data, "bar");
                    setActiveChartButton(barChartButton);
                });
            } else if (this.id === "btn-popular-requests") {
                fetchPopularRequestsData().then(data => {
                    renderPopularRequestsChart(data, "bar");
                    setActiveChartButton(barChartButton);
                });
            }
        });
    });


    // Обработка кликов для различных типов графиков и таблицы
    barChartButton.addEventListener("click", function () {
        handleChartButtonClick("bar");
    });

    pieChartButton.addEventListener("click", function () {
        handleChartButtonClick("pie");
    });

    tableButton.addEventListener("click", function () {
        handleChartButtonClick("table");
    });

});
