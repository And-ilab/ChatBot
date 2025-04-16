// Объект для хранения текущих фильтров
let currentFilters = {
    period: 0,
    userId: null,
    startDate: null,
    endDate: null
};

// Инициализация при загрузке страницы
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

// Восстановление активных фильтров в UI
function restoreActiveFilters() {
    $(`[data-period="${currentFilters.period}"]`).addClass('active');
    $('#filter-id').val(currentFilters.userId || '');
}

// Основная функция фильтрации
async function applyFilters() {
    try {
        // Показываем состояние загрузки
        const refreshBtn = document.getElementById('refresh-dialogs');
        if (refreshBtn) {
            refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise spin"></i>';
            refreshBtn.disabled = true;
        }

        const params = new URLSearchParams();

        // Добавляем текущие фильтры
        if (currentFilters.period > 0) params.append('period', currentFilters.period);
        if (currentFilters.userId) params.append('user_id', currentFilters.userId);
        if (currentFilters.startDate && currentFilters.endDate) {
            params.append('start', currentFilters.startDate);
            params.append('end', currentFilters.endDate);
        }

        const response = await fetch(`/api/filter_dialogs/?${params}`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        updateDialogList(data);
        saveFiltersToLocalStorage();

    } catch (error) {
        console.error('Ошибка фильтрации:', error);
        showErrorNotification('Произошла ошибка при загрузке данных');
    } finally {
        // Возвращаем кнопку в исходное состояние
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
    listItem.style.transition = 'background-color 0.3s ease';
    listItem.style.cursor = 'pointer';

    listItem.innerHTML = `
        <div class="chat-item-wrapper d-flex flex-column justify-content-between" style="width: 250px;">
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
                    ${dialog.last_message.length > 22 ?
                      dialog.last_message.slice(0, 22) + '...' :
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
        console.error('Ошибка при загрузке сообщений:', error);
        showErrorNotification('Не удалось загрузить сообщения');
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
                        ${new Date(message.timestamp).toLocaleString()}
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
    currentFilters = { period: 0, userId: null, startDate: null, endDate: null };
    document.getElementById('filter-id').value = '';
    document.getElementById('start-date').value = '';
    document.getElementById('end-date').value = '';
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
    const element = document.querySelector('.user-info h4');
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
//
//function showErrorNotification(message) {
//    // Реализация показа уведомления
//    console.error(message);
//    alert(message);
//}
function refreshDialogs() {
    // Можно добавить индикатор загрузки
    const refreshBtn = document.getElementById('refresh-dialogs');
    refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise spin"></i>';
    refreshBtn.disabled = true;

    // Применяем текущие фильтры
    applyFilters().finally(() => {
        // Возвращаем кнопку в исходное состояние
        refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i>';
        refreshBtn.disabled = false;
    });
}

// И привязать кнопку к этой функции
document.getElementById('refresh-dialogs').addEventListener('click', refreshDialogs);

// Инициализация обработчиков модальных окон
$(document).ready(function() {
    $('#open-id-filter-modal').click(() => $('#id-filter-modal').modal('show'));
    $('#close-id-modal').click(() => $('#id-filter-modal').modal('hide'));
    $('#filter-by-date-range-custom').click(() => $('#date-range-modal').modal('show'));
});