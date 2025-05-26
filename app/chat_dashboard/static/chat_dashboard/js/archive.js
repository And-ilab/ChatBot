// Объект для хранения текущих фильтров
let currentFilters = {
    period: 0,
    userId: null,
    startDate: null,
    endDate: null,
    lastName: null,
    content: null,
    ratingType: null
};


document.addEventListener('DOMContentLoaded', () => {
    initModals();
    loadFiltersFromLocalStorage();
    applyFilters();
    initDatePicker();
    restoreActiveFilters();
});

// Инициализация модальных окон
function initModals() {
    $('#id-filter-modal').on('show.bs.modal', () => {
        $('#filter-id').val(currentFilters.userId || '');
    });

    $('#date-range-modal').on('show.bs.modal', () => {
        $('#start-date').val(currentFilters.startDate || '');
        $('#end-date').val(currentFilters.endDate || '');
    });
}

document.getElementById('name-filter-modal-btn').addEventListener('click', () => {
    $('#name-filter-modal').modal('show');
});

document.getElementById('content-filter-modal-btn').addEventListener('click', () => {
    $('#content-filter-modal').modal('show');
});

document.getElementById('rating-filter-modal-btn').addEventListener('click', () => {
    $('#rating-filter-modal').modal('show');
});

// Apply name filter
document.getElementById('apply-name-filter').addEventListener('click', () => {
    currentFilters.lastName = document.getElementById('filter-name').value.trim();
    applyFilters();
    $('#name-filter-modal').modal('hide');
});

// Apply content filter
document.getElementById('apply-content-filter').addEventListener('click', () => {
    currentFilters.content = document.getElementById('filter-content').value.trim();
    applyFilters();
    $('#content-filter-modal').modal('hide');
});

// Apply rating filter
document.getElementById('apply-rating-filter').addEventListener('click', () => {
    currentFilters.ratingType = document.getElementById('filter-rating-type').value;
    applyFilters();
    $('#rating-filter-modal').modal('hide');
});

// Excel export
document.getElementById('export-excel-btn').addEventListener('click', async () => {
    try {
        const params = new URLSearchParams();

        // Add all current filters to the export request
        if (currentFilters.period > 0) params.append('period', currentFilters.period);
        if (currentFilters.userId) params.append('user_id', currentFilters.userId);
        if (currentFilters.startDate && currentFilters.endDate) {
            params.append('start', currentFilters.startDate);
            params.append('end', currentFilters.endDate);
        }
        if (currentFilters.lastName) params.append('last_name', currentFilters.lastName);
        if (currentFilters.content) params.append('content', currentFilters.content);
        if (currentFilters.ratingType) params.append('rating_type', currentFilters.ratingType);

        // Trigger download
        window.open(`/api/export_to_excel/?${params}`, '_blank');

    } catch (error) {
        showNotification('Ошибка при экспорте данных', 'alert-danger');
        console.error('Export error:', error);
    }
});

// Инициализация datepicker
function initDatePicker() {
    $('.datepicker').datepicker({
        format: 'yyyy-mm-dd',
        autoclose: true
    });
}

// Сохранение/загрузка состояния фильтров
function saveFiltersToLocalStorage() {
    localStorage.setItem('filters', JSON.stringify(currentFilters));
}

function loadFiltersFromLocalStorage() {
    const saved = localStorage.getItem('filters');
    if (saved) {
        currentFilters = JSON.parse(saved);
    }
}

function restoreActiveFilters() {
    $(`[data-period="${currentFilters.period}"]`).addClass('active');
    $('#filter-id').val(currentFilters.userId || '');
}

async function applyFilters() {
    try {
        const refreshBtn = document.getElementById('refresh-dialogs');
        if (refreshBtn) {
            refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise spin"></i>';
            refreshBtn.disabled = true;
        }

        const params = new URLSearchParams();
        if (currentFilters.period > 0) params.append('period', currentFilters.period);
        if (currentFilters.userId) params.append('user_id', currentFilters.userId);
        if (currentFilters.startDate && currentFilters.endDate) {
            params.append('start', currentFilters.startDate);
            params.append('end', currentFilters.endDate);
        }
        if (currentFilters.lastName) params.append('last_name', currentFilters.lastName);
        if (currentFilters.content) params.append('content', currentFilters.content);
        if (currentFilters.ratingType) params.append('rating_type', currentFilters.ratingType);

        const response = await fetch(`/api/filter_dialogs/?${params}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        updateDialogList(data);
        saveFiltersToLocalStorage();

    } catch (error) {
        showNotification('Произошла ошибка при загрузке данных', 'alert-danger');
    } finally {
        const refreshBtn = document.getElementById('refresh-dialogs');
        if (refreshBtn) {
            refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i>';
            refreshBtn.disabled = false;
        }
    }
}

// Обновление списка диалогов
function updateDialogList(data) {
    const chatList = document.querySelector('.chat-list');
    chatList.innerHTML = '';

    if (!data || data.length === 0) {
        chatList.appendChild(createEmptyMessage());
        return;
    }

    data.forEach(dialog => {
        const listItem = createDialogElement(dialog);
        chatList.appendChild(listItem);
    });

    if (data.length > 0) {
        autoSelectFirstDialog(chatList);
    }
}

// Создание элемента пустого списка
function createEmptyMessage() {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'text-center text-muted py-4';
    emptyItem.textContent = 'Диалогов за заданный промежуток нет';
    return emptyItem;
}

// Создание элемента диалога
function createDialogElement(dialog) {
    const listItem = document.createElement('li');
    listItem.className = 'chat-item border-top border-bottom py-3 px-2';
    listItem.id = `dialog-${dialog.id}`;
    listItem.dataset.username = dialog.user.username;
    listItem.dataset.userid = dialog.user.id;
    listItem.dataset.tabel = dialog.tabel_number;
    listItem.style.transition = 'background-color 0.3s ease';
    listItem.style.cursor = 'pointer';

    listItem.innerHTML = `
        <div class="chat-item-wrapper d-flex flex-column justify-content-between" style="width: 295px;">
            <div class="d-flex w-100 flex-row justify-content-between">
                <div class="chat_user w-50" style="overflow-x: hidden; font-weight: bold;">
                    ${dialog.user.username}
                </div>
                <div class="chat-time d-flex w-50 justify-content-end text-muted" style="overflow-x: hidden;">
                    <span class="timestamp">
                        ${new Date(dialog.last_message_timestamp).toLocaleString()}
                    </span>
                </div>
            </div>
            <div class="d-flex w-100">
                <p><strong>${dialog.last_message_username}:</strong></p>
                <p class="dialog-content mb-0">
                    ${dialog.last_message.length > 25 ?
                      dialog.last_message.slice(0, 25) + '...' :
                      dialog.last_message}
                </p>
            </div>
        </div>
    `;

    listItem.addEventListener('click', () => handleDialogClick(listItem, dialog));
    return listItem;
}

// Обработчик клика по диалогу
function handleDialogClick(element, dialog) {
    const allDialogs = document.querySelectorAll('.chat-item');
    allDialogs.forEach(d => d.style.backgroundColor = 'transparent');
    element.style.backgroundColor = '#e0e0e0';

    loadMessages(dialog.id);
    setActiveDialog(element);
    updateUserInfo(dialog.user.username);
    loadUserStatus(dialog.user.id);

    localStorage.setItem('selectedDialogId', dialog.id);
}

// Автовыбор первого диалога
function autoSelectFirstDialog(container) {
    const firstDialog = container.querySelector('.chat-item');
    if (firstDialog) {
        firstDialog.click();
    }
}

// Загрузка сообщений
async function loadMessages(dialogId) {
    try {
        const response = await fetch(`/api/messages/${dialogId}/`);
        const data = await response.json();
        renderMessages(data.messages);
    } catch (error) {
        showNotification('Не удалось загрузить сообщения', 'alert-danger');
    }
}

// Отрисовка сообщений
function renderMessages(messages) {
    const container = document.getElementById('chat-messages');
    container.innerHTML = '';

    messages.forEach(message => {
        if (message.message_type == 'message') {
            const messageElement = document.createElement('div');
            messageElement.className = `d-flex ${
                message.sender === 'bot' ? 'justify-content-start' : 'justify-content-end'
            } archive-item w-90 mb-3`;

            messageElement.innerHTML = `
                <div class="message-wrapper"
                     style="${message.sender === 'bot' ?
                       'background-color: #8cc3f4;' :
                       'background-color: #f1f1f1;'}
                            border-radius: 10px;
                            padding: 5px 10px 20px 10px;
                            position: relative;
                            min-width: 180px;
                            max-width: 70%;
                            overflow-wrap: break-word;">
                    <div class="d-flex message-sender">${message.sender}</div>
                    <div class="d-flex message-content">${message.content}</div>
                    <div class="d-flex message-time text-muted"
                         style="position: absolute; right: 10px; bottom: 2px;">
                        ${new Date(new Date(message.timestamp).getTime() + 3 * 60 * 60 * 1000).toLocaleString()}
                    </div>
                </div>
            `;
            container.appendChild(messageElement);
        }
    });

    container.scrollTop = container.scrollHeight;
}

// Обработчики фильтров
document.querySelectorAll('.dropdown-item[data-period]').forEach(item => {
    item.addEventListener('click', (e) => {
        $('.dropdown-item').removeClass('active');
        e.target.classList.add('active');
        currentFilters.period = parseInt(e.target.dataset.period);
        applyFilters();
    });
});

document.getElementById('apply-id-filter').addEventListener('click', () => {
    currentFilters.userId = document.getElementById('filter-id').value.trim();
    applyFilters();
    $('#id-filter-modal').modal('hide');
});

document.getElementById('submit-date-range').addEventListener('click', () => {
    currentFilters.startDate = document.getElementById('start-date').value;
    currentFilters.endDate = document.getElementById('end-date').value;
    currentFilters.period = 0;
    applyFilters();
    $('#date-range-modal').modal('hide');
});

document.getElementById('reset-filter').addEventListener('click', () => {
    currentFilters = {
        period: 0,
        userId: null,
        startDate: null,
        endDate: null,
        lastName: null,
        content: null,
        ratingType: null
    };

    document.getElementById('filter-id').value = '';
    document.getElementById('start-date').value = '';
    document.getElementById('end-date').value = '';
    document.getElementById('filter-name').value = '';
    document.getElementById('filter-content').value = '';

    $('.dropdown-item').removeClass('active');
    $('[data-period="0"]').addClass('active');
    applyFilters();
});

// Вспомогательные функции
function setActiveDialog(element) {
    document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
}

function updateUserInfo(username) {
    const element = document.querySelector('#user-info-username');
    if (element) element.textContent = username;

}


async function loadUserStatus(userId) {
    try {
        const response = await fetch(`/api/get_info/${userId}/`);
        const data = await response.json();
        updateStatusUI(data.status);
    } catch (error) {
        console.error('Ошибка загрузки статуса:', error);
    }
}

function updateStatusUI(status) {
    const statusElement = document.getElementById('user-info-status');
    const lastActiveElement = document.getElementById('user-info-last-active');
    const company = document.getElementById('user-info-company');
    const title = document.getElementById('user-info-title');
    const department = document.getElementById('user-info-department');
    const tabel_number = document.getElementById('user-info-tabel-number');


    company.textContent = `${status.company}`;
    title.textContent = `${status.title}`;
    department.textContent = `${status.department}`;
    tabel_number.textContent = `${status.tabel_number}`;

    if (status.is_online) {
        statusElement.innerHTML = '<span style="color: green;">Активен</span>';
        lastActiveElement.textContent = 'Последняя активность: недавно';
    } else {
        statusElement.innerHTML = '<span style="color: red;">Не активен</span>';
        lastActiveElement.textContent = `Последняя активность: ${
            new Date(status.last_active).toLocaleString()
        }`;
    }
}

$(document).ready(function() {
    $('#id-filter-modal-btn').click(() => $('#id-filter-modal').modal('show'));
    $('#close-id-modal').click(() => $('#id-filter-modal').modal('hide'));
    $('#filter-by-date-range-custom').click(() => $('#date-range-modal').modal('show'));
});

function refreshDialogs() {
    const refreshBtn = document.getElementById('refresh-dialogs');

    refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise spin"></i>';
    refreshBtn.disabled = true;

    applyFilters().finally(() => {
        refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i>';
        refreshBtn.disabled = false;
    });
}


document.getElementById('refresh-dialogs').addEventListener('click', refreshDialogs);