document.addEventListener("DOMContentLoaded", function () {
    const buttons = document.querySelectorAll(".sidebar-btn");
    const barChartButton = document.getElementById("btn-bar-chart");
    const pieChartButton = document.getElementById("btn-pie-chart");
    const tableButton = document.getElementById("btn-table");
    const exportButton = document.getElementById("export-button");
    const satisfactionButton = document.getElementById("btn-satisfaction-level");
    const messagesCountButton = document.getElementById("btn-messages-count");
    const usersActivityButton = document.getElementById("btn-users-activity");
    const iteractionsFrequencyButton = document.getElementById("btn-iteractions-frequency");
    const failureFrequencyButton = document.getElementById("btn-failure-frequency");
    const popularRequestsButton = document.getElementById("btn-popular-requests");
    const filterItems = document.querySelectorAll('.filter-item');
    const dropdownMenu = document.querySelector('.dropdown-menu');
    const monthPicker = document.getElementById('month-picker');
    const datePicker = document.getElementById('date-picker');
    const customMonthTrigger = document.getElementById('custom-month-trigger');
    const customDateTrigger = document.getElementById('custom-date-trigger');

    let currentType = 'messages';

    messagesCountButton.classList.add("active");
    fetchMessagesCountData().then(data => {
        renderMessagesCountChart(data, "bar");
        setActiveChartButton(barChartButton);
    });

    function transformData(data) {
        return Object.entries(data).map(([date, values]) => [date, values.user, values.bot]);
    }


    async function exportToExcelByType(type) {
        const filenameMap = {
            popular: "popular_requests.xlsx",
            failure: "failure_frequency.xlsx",
            messages: "messages_count.xlsx",
            satisfaction: "satisfaction_chart.xlsx",
            userActivity: "user_activity.xlsx"
        };

        const titleMap = {
            popular: "Отчет по популярным запросам",
            failure: "Отчет по частоте сбоев",
            messages: "Отчет по количеству сообщений",
            satisfaction: "Отчет по оценкам пользователей",
            userActivity: "Отчет по активности пользователей"
        };

        try {
            const filename = filenameMap[type];
            const title = titleMap[type];

            if (!currentExportData || !currentExportData.meta || !currentExportData.meta.dateRange) {
                throw new Error("Данные для экспорта не найдены или неполные.");
            }

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet("Отчет");

            worksheet.addRow([title]);
            worksheet.addRow([`Период: с ${currentExportData.meta.dateRange.start} по ${currentExportData.meta.dateRange.end}`]);
            worksheet.addRow([`Сгенерировано: ${new Date().toLocaleString()}`]);
            worksheet.addRow([]);

            let headers = [];
            let rows = [];
            if (type === "popular") {
                headers = ["Дата", ...currentExportData.meta.requestTypes];
                const sortedDates = Object.keys(currentExportData.data).sort();
                rows = sortedDates.map(date => {
                    const row = [date];
                    currentExportData.meta.requestTypes.forEach(type => {
                        row.push(currentExportData.data[date][type]);
                    });
                    return row;
                });

                // Итоговая строка
                const totals = ["Итого"];
                currentExportData.meta.requestTypes.forEach(type => {
                    const total = sortedDates.reduce((sum, date) => sum + currentExportData.data[date][type], 0);
                    totals.push(total);
                });
                rows.push(totals);

            } else if (type === "failure") {
                headers = ["Дата", "Количество сбоев"];
                const sortedDates = Object.keys(currentExportData.data).sort();
                rows = sortedDates.map(date => [date, currentExportData.data[date]]);
                const total = sortedDates.reduce((sum, d) => sum + currentExportData.data[d], 0);
                rows.push(["Итого", total]);

            } else if (type === "messages") {
                headers = ["Дата", "Сообщения от пользователя", "Ответы бота"];
                const sortedDates = Object.keys(currentExportData.data).sort();
                rows = sortedDates.map(date => [
                    date,
                    currentExportData.data[date].user,
                    currentExportData.data[date].bot
                ]);
                const userTotal = sortedDates.reduce((sum, d) => sum + currentExportData.data[d].user, 0);
                const botTotal = sortedDates.reduce((sum, d) => sum + currentExportData.data[d].bot, 0);
                rows.push(["Итого", userTotal, botTotal]);

            } else if (type === "satisfaction") {
                headers = ["Дата", "Лайки", "Дизлайки"];
                const sortedDates = Object.keys(currentExportData.data).sort();
                rows = sortedDates.map(date => [
                    date,
                    currentExportData.data[date].likes,
                    currentExportData.data[date].dislikes
                ]);
                const likesTotal = sortedDates.reduce((sum, d) => sum + currentExportData.data[d].likes, 0);
                const dislikesTotal = sortedDates.reduce((sum, d) => sum + currentExportData.data[d].dislikes, 0);
                rows.push(["Итого", likesTotal, dislikesTotal]);

            } else if (type === "userActivity") {
                headers = ["Дата", "Уникальных пользователей"];
                const sortedDates = Object.keys(currentExportData.data).sort();
                rows = sortedDates.map(date => [date, currentExportData.data[date]]);
                const total = sortedDates.reduce((sum, d) => sum + currentExportData.data[d], 0);
                rows.push(["Итого", total]);
            }

            const headerRow = worksheet.addRow(headers);
            headerRow.eachCell(cell => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF4472C4' }
                };
                cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });

            rows.forEach(row => worksheet.addRow(row));

            const totalRow = worksheet.getRow(worksheet.rowCount);
            totalRow.eachCell(cell => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF2F2F2' }
                };
                cell.font = { bold: true };
            });

            worksheet.columns.forEach(column => {
                let maxLength = 15;
                column.eachCell({ includeEmpty: true }, cell => {
                    const value = cell.value?.toString() || '';
                    if (value.length > maxLength) maxLength = value.length;
                });
                column.width = Math.min(maxLength + 2, 30);
            });

            for (let i = 5; i <= worksheet.rowCount; i++) {
                for (let j = 1; j <= headers.length; j++) {
                    const cell = worksheet.getCell(i, j);
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                }
            }

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            });
            saveAs(blob, filename);

        } catch (err) {
            console.error("Ошибка экспорта:", err);
            alert("Не удалось экспортировать отчет. Проверьте консоль.");
        }
    }

    exportButton.addEventListener("click", function () {
        if (currentExportData) {
            exportToExcelByType(currentType);
        } else {
            alert("Нет данных для экспорта.");
        }
    });

    filterItems.forEach(item => {
        item.addEventListener('click', function () {
            const period = this.dataset.period;

            filterItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');

            if (period !== 'custom-month' && period !== 'custom-date') {
                selectedMonth = null;
                selectedDate = null;
                monthPicker.value = '';
                datePicker.value = '';
            }

            if (period === 'custom-month') {
                datePicker.style.display = 'none';
                monthPicker.style.display = 'block';
                monthPicker.focus();
            } else if (period === 'custom-date') {
                monthPicker.style.display = 'none';
                datePicker.style.display = 'block';
                datePicker.focus();
            } else {
                monthPicker.style.display = 'none';
                datePicker.style.display = 'none';
                currentFilter.type = period;
            }

            refreshData();
        });
    });


    customMonthTrigger.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        monthPicker.style.display = 'block';
        datePicker.style.display = 'none';
        monthPicker.focus();
    });

    customDateTrigger.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        datePicker.style.display = 'block';
        monthPicker.style.display = 'none';
        datePicker.focus();
    });

    monthPicker.addEventListener('change', function() {
        selectedMonth = monthPicker.value;
        selectedDate = null;
        console.log('Выбран месяц:', selectedMonth);
        refreshData();
    });

    datePicker.addEventListener('change', function() {
        selectedDate = datePicker.value;
        selectedMonth = null;
        console.log('Выбрана дата:', selectedDate);
        refreshData();
    });

    monthPicker.addEventListener('click', function(event) {
        event.stopPropagation();
    });

    monthPicker.addEventListener('input', function(event) {
        event.stopPropagation();
    });

    datePicker.addEventListener('click', function(event) {
        event.stopPropagation();
    });

    datePicker.addEventListener('input', function(event) {
        event.stopPropagation();
    });

    monthPicker.addEventListener('blur', function() {
        const dropdown = new bootstrap.Dropdown(document.getElementById('dropdownMenuButton'));
        dropdown.hide();
    });

    datePicker.addEventListener('blur', function() {
        const dropdown = new bootstrap.Dropdown(document.getElementById('dropdownMenuButton'));
        dropdown.hide();
    });

    monthPicker.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            const dropdown = new bootstrap.Dropdown(document.getElementById('dropdownMenuButton'));
            dropdown.hide();
        }
    });

    datePicker.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            const dropdown = new bootstrap.Dropdown(document.getElementById('dropdownMenuButton'));
            dropdown.hide();
        }
    });

    function getActiveChartFunctions() {
        const activeButton = document.querySelector(".sidebar-btn.active");
        if (!activeButton) return {};

        const mapping = {
            "btn-satisfaction-level": [fetchSatisfactionData, renderSatisfactionChart, renderSatisfactionTable],
            "btn-messages-count": [fetchMessagesCountData, renderMessagesCountChart, renderMessagesCountTable],
            "btn-users-activity": [fetchUserActivityData, renderUserActivityChart, renderUserActivityTable],
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

    function filterData(data) {
        if (selectedDate) {
            const selected = new Date(selectedDate);
            return data.filter(item => {
                const itemDate = new Date(item.created_at);
                return (
                    itemDate.getFullYear() === selected.getFullYear() &&
                    itemDate.getMonth() === selected.getMonth() &&
                    itemDate.getDate() === selected.getDate()
                );
            });
        } else if (selectedMonth) {
            const selected = new Date(selectedMonth);
            return data.filter(item => {
                const itemDate = new Date(item.created_at);
                return (
                    itemDate.getFullYear() === selected.getFullYear() &&
                    itemDate.getMonth() === selected.getMonth()
                );
            });
        } else {
            const { start, end } = getDateRange();
            return data.filter(item => {
                const itemDate = new Date(item.created_at);
                return itemDate >= start && itemDate <= end;
            });
        }
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
                currentType = 'satisfaction';
                fetchSatisfactionData().then(data => {
                    renderSatisfactionChart(data, "bar");
                    setActiveChartButton(barChartButton);
                });
            } else if (this.id === "btn-messages-count") {
                currentType = 'messages';
                fetchMessagesCountData().then(data => {
                    renderMessagesCountChart(data, "bar");
                    setActiveChartButton(barChartButton);
                });
            } else if (this.id === "btn-users-activity") {
                currentType = 'userActivity';
                fetchUserActivityData().then(data => {
                    renderUserActivityChart(data, "bar");
                    setActiveChartButton(barChartButton);
                });
            } else if (this.id === "btn-failure-frequency") {
                currentType = 'failure';
                fetchFailureFrequencyData().then(data => {
                    renderFailureFrequencyChart(data, "bar");
                    setActiveChartButton(barChartButton);
                });
            } else if (this.id === "btn-popular-requests") {
                currentType = 'popular';
                fetchPopularRequestsData().then(data => {
                    renderPopularRequestsChart(data, "bar");
                    setActiveChartButton(barChartButton);
                });
            }
        });
    });

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