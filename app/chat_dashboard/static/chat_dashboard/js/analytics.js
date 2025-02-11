document.addEventListener("DOMContentLoaded", function () {
    // Элементы
    const buttons = document.querySelectorAll(".sidebar-btn");

    const barChartButton = document.getElementById("btn-bar-chart");
    const pieChartButton = document.getElementById("btn-pie-chart");
    const tableButton = document.getElementById("btn-table");

    const exportButton = document.getElementById("export-button");
    const exportCsvButton = document.getElementById("exportCsv");
    const exportExcelButton = document.getElementById("exportExcel");

    const satisfactionButton = document.getElementById("btn-satisfaction-level");
    const messagesCountButton = document.getElementById("btn-messages-count");
    const usersActivityButton = document.getElementById("btn-users-activity");
    const iteractionsFrequencyButton = document.getElementById("btn-iteractions-frequency");
    const failureFrequencyButton = document.getElementById("btn-failure-frequency");
    const popularRequestsButton = document.getElementById("btn-popular-requests");

    // Фильтр
    const filterItems = document.querySelectorAll('.filter-item');
    const dropdownMenu = document.querySelector('.dropdown-menu');
    const monthPicker = document.getElementById('month-picker');
    const datePicker = document.getElementById('date-picker');
    const customMonthTrigger = document.getElementById('custom-month-trigger');
    const customDateTrigger = document.getElementById('custom-date-trigger');


    messagesCountButton.classList.add("active");
    fetchMessagesCountData().then(data => {
        renderMessagesCountChart(data, "bar");
        setActiveChartButton(barChartButton);
    });

    exportButton.addEventListener("click", function () {
        const exportModal = new bootstrap.Modal(document.getElementById("exportModal"));
        exportModal.show();
        console.log(currentExportData);
    });

    function transformData(data) {
        return Object.entries(data).map(([date, values]) => [date, values.user, values.bot]);
    }

    function exportToCsv(data, filename = "data.csv") {
        const csvContent = "data:text/csv;charset=utf-8," + data.map(row => row.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    async function exportToExcel(dataObj, filename = "data.xlsx") {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Sheet_Export");

        // Преобразуем объект в массив массивов (добавляем дату в начало каждой строки)
        const rows = Object.entries(dataObj).map(([date, values]) => [date, ...Object.values(values)]);

        // Добавляем строки в лист (без заголовков)
        rows.forEach(row => worksheet.addRow(row));

        // Генерация и скачивание файла
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

        saveAs(blob, filename);
    }



    // Экспорт в CSV
    exportCsvButton.addEventListener("click", function () {
        if (currentExportData) {
            const transformedData = transformData(currentExportData);
            exportToCsv(transformedData, "export.csv");
        } else {
            alert("Нет данных для экспорта.");
        }
    });

    // Экспорт в Excel
    exportExcelButton.addEventListener("click", function () {
        if (currentExportData) {
            exportToExcel(currentExportData, "export.xlsx");
        } else {
            alert("Нет данных для экспорта.");
        }
    });

    // Обработчик выбора фильтра
    filterItems.forEach(item => {
        item.addEventListener('click', function () {
            const period = this.dataset.period;

            filterItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');

            if (period === 'custom-month') {
                datePicker.style.display = 'none';
                monthPicker.style.display = 'block';
                monthPicker.focus(); // Фокусируемся на поле выбора месяца
            } else if (period === 'custom-date') {
                monthPicker.style.display = 'none';
                datePicker.style.display = 'block';
                datePicker.focus(); // Фокусируемся на поле выбора даты
            } else {
                monthPicker.style.display = 'none';
                datePicker.style.display = 'none';
                currentFilter.type = period;
                refreshData(); // Обновляем данные
            }
        });
    });

    // Обработчик для выбора месяца
    customMonthTrigger.addEventListener('click', function(event) {
        event.preventDefault(); // Предотвращаем действие по умолчанию
        event.stopPropagation(); // Предотвращаем закрытие дропдауна
        monthPicker.style.display = 'block'; // Показываем поле выбора месяца
        datePicker.style.display = 'none'; // Скрываем поле выбора даты
        monthPicker.focus(); // Фокусируемся на поле выбора месяца
    });

    // Обработчик для выбора даты
    customDateTrigger.addEventListener('click', function(event) {
        event.preventDefault(); // Предотвращаем действие по умолчанию
        event.stopPropagation(); // Предотвращаем закрытие дропдауна
        datePicker.style.display = 'block'; // Показываем поле выбора даты
        monthPicker.style.display = 'none'; // Скрываем поле выбора месяца
        datePicker.focus(); // Фокусируемся на поле выбора даты
    });

    // Обработчик для выбора месяца
    monthPicker.addEventListener('change', function() {
        selectedMonth = monthPicker.value;
        selectedDate = null; // Сбрасываем выбранную дату
        console.log('Выбран месяц:', selectedMonth);
        refreshData(); // Обновляем данные
    });

    // Обработчик для выбора даты
    datePicker.addEventListener('change', function() {
        selectedDate = datePicker.value;
        selectedMonth = null; // Сбрасываем выбранный месяц
        console.log('Выбрана дата:', selectedDate);
        refreshData(); // Обновляем данные
    });

    // Предотвращение закрытия дропдауна при вводе данных
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

    // Закрытие дропдауна при потере фокуса
    monthPicker.addEventListener('blur', function() {
        const dropdown = new bootstrap.Dropdown(document.getElementById('dropdownMenuButton'));
        dropdown.hide(); // Закрываем дропдаун
    });

    datePicker.addEventListener('blur', function() {
        const dropdown = new bootstrap.Dropdown(document.getElementById('dropdownMenuButton'));
        dropdown.hide(); // Закрываем дропдаун
    });

    // Закрытие дропдауна при нажатии Enter
    monthPicker.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            const dropdown = new bootstrap.Dropdown(document.getElementById('dropdownMenuButton'));
            dropdown.hide(); // Закрываем дропдаун
        }
    });

    datePicker.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            const dropdown = new bootstrap.Dropdown(document.getElementById('dropdownMenuButton'));
            dropdown.hide(); // Закрываем дропдаун
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


    // Обновленная функция фильтрации
    function filterData(data) {
        if (selectedDate) {
            // Фильтрация по выбранной дате
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
            // Фильтрация по выбранному месяцу
            const selected = new Date(selectedMonth);
            return data.filter(item => {
                const itemDate = new Date(item.created_at);
                return (
                    itemDate.getFullYear() === selected.getFullYear() &&
                    itemDate.getMonth() === selected.getMonth()
                );
            });
        } else {
            // Фильтрация по текущему периоду (если не выбрана дата или месяц)
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
