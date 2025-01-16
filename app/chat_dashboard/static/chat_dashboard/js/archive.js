// Загрузка сообщений для выбранного диалога
async function loadMessages(dialogId) {
    const allDialogs = document.querySelectorAll('.chat-item');
    allDialogs.forEach(dialog => dialog.style.backgroundColor = 'transparent');

    const selectedDialog = document.getElementById(`dialog-${dialogId}`);
    if (selectedDialog) selectedDialog.style.backgroundColor = '#e0e0e0';

    try {
        const response = await fetch(`/api/messages/${dialogId}/`);
        const data = await response.json();

        const chatMessagesContainer = document.getElementById('chat-messages');
        chatMessagesContainer.innerHTML = '';

        data.messages.forEach(message => {
            const messageElement = document.createElement('div');
            messageElement.classList.add(
                'd-flex',
                message.sender === 'bot' ? 'justify-content-start' : 'justify-content-end',
                'archive-item',
                'w-90',
                'mb-3'
            );
            messageElement.innerHTML = `
                <div class="message-wrapper"
                     style="${message.sender === 'bot' ? 'background-color: #8cc3f4;' : 'background-color: #f1f1f1;'}
                            border-radius: 10px; padding: 5px 10px 20px 10px; position: relative;
                            min-width: 180px; max-width: 70%; overflow-wrap: break-word;">
                    <div class="d-flex message-sender">${message.sender}</div>
                    <div class="d-flex message-content">${message.content}</div>
                    <div class="d-flex message-time text-muted" style="position: absolute; right: 10px; bottom: 2px;">
                        ${new Date(new Date(message.timestamp).getTime() + 3 * 60 * 60 * 1000).toLocaleString()}
                    </div>
                </div>
            `;
            chatMessagesContainer.appendChild(messageElement);
        });

        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    } catch (error) {
        console.error('Ошибка при загрузке сообщений:', error);
    }
}
// Загрузка статуса пользователя
async function loadUserStatus(userId) {
    try {
        const response = await fetch(`/api/get_info/${userId}/`);
        const statusData = await response.json();

        const statusElement = document.getElementById('user-info-status');
        const lastActiveElement = document.getElementById('user-info-last-active');

        if (statusData.status.is_online) {
            statusElement.innerHTML = `
                <span style="color: green;">
                    Активен
                </span>
            `;
            lastActiveElement.innerHTML = `Последняя активность: недавно`;
        } else {
            statusElement.innerHTML = `
                <span style="color: red;">
                    Не активен
                </span>
            `;
            lastActiveElement.innerHTML = `Последняя активность: ${new Date(statusData.status.last_active).toLocaleString()}`;
        }
    } catch (error) {
        console.error('Ошибка при загрузке статуса пользователя:', error);
    }
}

// Установка активного диалога
function setActiveDialog(dialogElement) {
    const dialogs = document.querySelectorAll('.chat-item');
    dialogs.forEach(dialog => dialog.classList.remove('active'));
    dialogElement.classList.add('active');
}

// Обновление информации о пользователе
function updateUserInfo(username) {
    const userInfoElement = document.querySelector('.user-info h4');
    if (userInfoElement) {
        userInfoElement.textContent = username;
    }
}

// Функция для загрузки и обновления диалогов
async function filterDialogs(period) {
    try {
        const response = await fetch(`/api/filter_dialogs/${period}/`);
        const dialogs = await response.json();

        const chatList = document.querySelector('.chat-list');
        chatList.innerHTML = '';

        dialogs.forEach(dialog => {
            const listItem = document.createElement('li');
            listItem.className = 'chat-item border-top border-bottom py-3 px-2';
            listItem.id = `dialog-${dialog.id}`;
            listItem.dataset.username = dialog.user.username;
            listItem.dataset.userid = dialog.user.id;
            listItem.style.transition = 'background-color 0.3s ease; cursor: pointer';
            listItem.onclick = () => {
                loadMessages(dialog.id);
                setActiveDialog(listItem);
                updateUserInfo(dialog.user.username);
                loadUserStatus(dialog.user.id);
            };
            listItem.innerHTML = `
                <div class="chat-item-wrapper d-flex flex-column justify-content-between" style="width: 250px;">
                    <div class="d-flex w-100 flex-row justify-content-between">
                        <div class="chat_user w-50" style="overflow-x: hidden; font-weight: bold;">${dialog.user.username}</div>
                        <div class="chat-time d-flex w-50 justify-content-end text-muted" style="overflow-x: hidden;">
                            <span class="timestamp">${new Date(dialog.last_message_timestamp).toLocaleString()}</span>
                        </div>
                    </div>
                    <div class="d-flex w-100">
                        <p><strong>${dialog.last_message_username}:</strong></p>
                        <p class="dialog-content mb-0">${dialog.last_message.length > 25 ? dialog.last_message.slice(0, 25) + '...' : dialog.last_message}</p>
                    </div>
                </div>
            `;
            chatList.appendChild(listItem);
        });
    } catch (error) {
        console.error('Ошибка при фильтрации диалогов:', error);
    }
}

// Установка обработчиков событий после загрузки страницы
document.addEventListener('DOMContentLoaded', () => {
    const allDialogs = document.querySelectorAll('.chat-item');

    if (allDialogs.length > 0) {
        const firstDialog = allDialogs[0];
        const dialogId = firstDialog.id.split('-')[1];

        // Подгружаем сообщения для первого диалога
        loadMessages(dialogId);
        setActiveDialog(firstDialog);
        updateUserInfo(firstDialog.dataset.username);
        loadUserStatus(firstDialog.dataset.userid);
    }

    allDialogs.forEach(dialog => {
        dialog.addEventListener('click', () => {
            const dialogId = dialog.id.split('-')[1];
            localStorage.setItem('selectedDialogId', dialogId);
            loadMessages(dialogId);
            setActiveDialog(dialog);
            updateUserInfo(dialog.dataset.username);
            loadUserStatus(dialog.dataset.userid);
        });
    });

    // Обработчик кликов для фильтра
    document.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', (event) => {
            const period = event.target.textContent.trim();
            let days;

            switch (period) {
                case 'Все сообщения':
                    days = 0;
                    break;
                case 'Сегодня':
                    days = 1;
                    break;
                case 'Вчера':
                    days = 2;
                    break;
                case 'За неделю':
                    days = 7;
                    break;
                case 'За месяц':
                    days = 30;
                    break;
                case 'За три месяца':
                    days = 90;
                    break;
                case 'За год':
                    days = 365;
                    break;

                default:
                    return;
            }

            // Обновление списка диалогов
            filterDialogs(days);
        });
    });
});
    document.addEventListener('DOMContentLoaded', () => {
        const filterDropdown = document.getElementById('filterDropdown');
        const filterMenu = document.getElementById('filter-menu');
        const dateFilterMenu = document.getElementById('date-filter-menu');

        // Показать меню фильтров при наведении
        filterDropdown.addEventListener('mouseenter', () => {
            filterMenu.style.display = 'block';
        });

        // Обработчик для выбора фильтра по дате
        document.getElementById('filter-by-date').addEventListener('mouseenter', () => {
            dateFilterMenu.style.display = 'block';
        });

        // Скрыть меню фильтров при уходе курсора
        const hideMenus = () => {
            if (!filterDropdown.matches(':hover') && !filterMenu.matches(':hover') && !dateFilterMenu.matches(':hover')) {
                filterMenu.style.display = 'none';
                dateFilterMenu.style.display = 'none';
            }
        };

        // Скрыть меню фильтров, когда мышь уходит
        filterDropdown.addEventListener('mouseleave', hideMenus);
        filterMenu.addEventListener('mouseleave', hideMenus);
        dateFilterMenu.addEventListener('mouseleave', hideMenus);

        // Обработчики выбора периода
        document.querySelectorAll('#date-filter-menu .dropdown-item').forEach(item => {
            item.addEventListener('click', (event) => {
                const period = event.target.getAttribute('data-period');
                console.log(`Выбран период: ${period}`);
                dateFilterMenu.style.display = 'none'; // Скрыть меню после выбора
                filterDialogs(period); // Логика фильтрации
            });
        });

        // Скрыть меню при нажатии вне
        document.addEventListener('click', (event) => {
            if (!filterDropdown.contains(event.target) && !filterMenu.contains(event.target) && !dateFilterMenu.contains(event.target)) {
                filterMenu.style.display = 'none';
                dateFilterMenu.style.display = 'none';
            }
        });
    });


document.addEventListener('DOMContentLoaded', () => {
    const filterById = document.getElementById('filter-by-id');

    // Обработчик для фильтрации по ID пользователя
    filterById.addEventListener('click', () => {
        const userId = prompt("Введите ID пользователя для фильтрации:");
        if (userId) {
            filterDialogsById(userId);
        }
    });
});



// Функция фильтрации диалогов по ID пользователя
async function filterDialogsById(userId) {
    try {
        const response = await fetch(`/api/filter_dialogs_by_id/${userId}/`);
        const dialogs = await response.json();

        const chatList = document.querySelector('.chat-list');
        chatList.innerHTML = '';

        dialogs.forEach(dialog => {
            const listItem = document.createElement('li');
            listItem.className = 'chat-item border-top border-bottom py-3 px-2';
            listItem.id = `dialog-${dialog.id}`;
            listItem.dataset.username = dialog.user.username;
            listItem.dataset.userid = dialog.user.id;
            listItem.style.transition = 'background-color 0.3s ease; cursor: pointer';
            listItem.onclick = () => {
                loadMessages(dialog.id);
                setActiveDialog(listItem);
                updateUserInfo(dialog.user.username);
                loadUserStatus(dialog.user.id);
            };
            listItem.innerHTML = `
                <div class="chat-item-wrapper d-flex flex-column justify-content-between" style="width: 250px;">
                    <div class="d-flex w-100 flex-row justify-content-between">
                        <div class="chat_user w-50" style="overflow-x: hidden; font-weight: bold;">${dialog.user.username}</div>
                        <div class="chat-time d-flex w-50 justify-content-end text-muted" style="overflow-x: hidden;">
                            <span class="timestamp">${new Date(dialog.last_message_timestamp).toLocaleString()}</span>
                        </div>
                    </div>
                    <div class="d-flex w-100">
                        <p><strong>${dialog.last_message_username}:</strong></p>
                        <p class="dialog-content mb-0">${dialog.last_message.length > 25 ? dialog.last_message.slice(0, 25) + '...' : dialog.last_message}</p>
                    </div>
                </div>
            `;
            chatList.appendChild(listItem);
        });
    } catch (error) {
        console.error('Ошибка при фильтрации диалогов:', error);
    }
}

document.getElementById('submit-date-range').addEventListener('click', async () => {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;

    if (startDate && endDate) {
        await filterDialogsByDateRange(startDate, endDate);
        $('#date-range-modal').modal('hide'); // Закрытие модального окна
    } else {
        alert("Пожалуйста, выберите обе даты.");
    }
});
// Функция фильтрации диалогов по диапазону дат
async function filterDialogsByDateRange(startDate, endDate) {
    try {
        const response = await fetch(`/api/filter_dialogs_by_date_range/?start=${startDate}&end=${endDate}`);
        const dialogs = await response.json();

        const chatList = document.querySelector('.chat-list');
        chatList.innerHTML = ''; // Очистка списка перед добавлением новых диалогов

        // Обновление списка диалогов
        dialogs.forEach(dialog => {
            const listItem = document.createElement('li');
            listItem.className = 'chat-item border-top border-bottom py-3 px-2';
            listItem.id = `dialog-${dialog.id}`;
            listItem.dataset.username = dialog.user.username;
            listItem.dataset.userid = dialog.user.id;
            listItem.onclick = () => {
                loadMessages(dialog.id);
                setActiveDialog(listItem);
                updateUserInfo(dialog.user.username);
                loadUserStatus(dialog.user.id);
            };
            listItem.innerHTML = `
                <div class="chat-item-wrapper d-flex flex-column justify-content-between" style="width: 250px;">
                    <div class="d-flex w-100 flex-row justify-content-between">
                        <div class="chat_user w-50" style="overflow-x: hidden; font-weight: bold;">${dialog.user.username}</div>
                        <div class="chat-time d-flex w-50 justify-content-end text-muted" style="overflow-x: hidden;">
                            <span class="timestamp">${new Date(dialog.last_message_timestamp).toLocaleString()}</span>
                        </div>
                    </div>
                    <div class="d-flex w-100">
                        <p><strong>${dialog.last_message_username}:</strong></p>
                        <p class="dialog-content mb-0">${dialog.last_message.length > 25 ? dialog.last_message.slice(0, 25) + '...' : dialog.last_message}</p>
                    </div>
                </div>
            `;
            chatList.appendChild(listItem);
        });
    } catch (error) {
        console.error('Ошибка при фильтрации диалогов:', error);
    }
}

document.getElementById('filter-by-date-range-custom').addEventListener('click', () => {
    // Открытие модального окна
    $('#date-range-modal').modal('show');
});
$(document).ready(function() {
    $('.datepicker').datepicker({
        format: 'yyyy-mm-dd',
        autoclose: true
    });
});