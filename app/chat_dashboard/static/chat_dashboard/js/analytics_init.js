const canvasContainer = document.querySelector(".analytics-canvas");

let selectedDate = null;
let selectedMonth = null;
let chartInstance = null;
let currentFilter = {
    type: 'month',
    value: null
};

function getDateRange() {
    const now = new Date();

    switch(currentFilter.type) {
        case 'day':
            const startDay = new Date();
            startDay.setHours(0,0,0,0);
            return {
                start: startDay,
                end: new Date()
            };

        case 'week':
            const startWeek = new Date();
            startWeek.setDate(startWeek.getDate() - 6);
            startWeek.setHours(0,0,0,0);
            return {
                start: startWeek,
                end: new Date()
            };

        case 'custom-month':
            return {
                start: currentFilter.value.start,
                end: currentFilter.value.end
            };

        case 'custom-date':
            return {
                start: currentFilter.value.start,
                end: currentFilter.value.end
            };

        default: // month
            const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            endMonth.setHours(23,59,59,999);
            return {
                start: startMonth,
                end: endMonth
            };
    }
}

function generateDateRange(start, end) {
    const dates = [];
    const current = new Date(start);

    while (current <= end) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
    }
    return dates;
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString("ru-RU");
}

const getRandomColor = () => {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
};