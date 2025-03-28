document.addEventListener("DOMContentLoaded", function () {
    const unreadMessagesContainer = document.getElementById("unread-messages");
    const ignoredMessagesContainer = document.getElementById("ignored-messages");
    const allMessagesContainer = document.getElementById("searched-messages");
    const unreadButton = document.getElementById("btn-unread");
    const ignoredButton = document.getElementById("btn-ignored");

    unreadMessagesContainer.classList.remove("hidden");
    unreadButton.classList.add("active");

    const allMessages = [];

    document.querySelectorAll('.message-item').forEach(item => {
        const content = item.querySelector('.mb-0').textContent;
        const messageId = item.querySelector('[data-message-id]').getAttribute('data-message-id');
        allMessages.push({
            id: messageId,
            content: content
        });
    });

    const searchInput = document.getElementById('search-input');
    const dropdownMenu = document.getElementById('suggestionsList');

    let searchTimeout;

    searchInput.addEventListener('input', function (e) {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(handleSearch, 300);
    });

    searchInput.addEventListener('focus', () => {
        if (searchInput.value !== '') {
            dropdownMenu.classList.remove('hidden');
        }
    });

    function handleSearch() {
        const inputText = searchInput.value.toLowerCase();
        const filteredMessages = allMessages.filter(message =>
            message.content.toLowerCase().includes(inputText)
        );

        updateDropdown(filteredMessages);
    }

    function updateDropdown(messages) {
        dropdownMenu.innerHTML = '';
        dropdownMenu.classList.remove('hidden');

        if (messages.length === 0) {
            const messageItem = document.createElement('li');
            messageItem.className = 'list-group-item list-group-item-action';
            messageItem.innerHTML = 'Нет результатов';
            dropdownMenu.appendChild(messageItem);
            return;
        }

        messages.forEach(message => {
            const messageItem = document.createElement('li');
            messageItem.className = 'list-group-item list-group-item-action p-0'; // Добавляем p-0 для удаления внутренних отступов

            const link = document.createElement('a');
            link.href = `/chat_dashboard/training/train/${message.id}/`;
            link.className = 'd-block w-100 h-100 p-3 text-decoration-none text-muted'; // Добавляем d-block, p-3 для отступов внутри ссылки
            link.textContent = message.content;

            messageItem.appendChild(link);
            dropdownMenu.appendChild(messageItem);
        });
    }

    dropdownMenu.addEventListener('click', function (e) {
        const link = e.target.closest('a');
        if (link) {
            window.location.href = link.href;
        }
    });

    document.addEventListener('click', function (event) {
        const isSearchInput = searchInput.contains(event.target);
        const isDropdown = dropdownMenu.contains(event.target);
        if (!isSearchInput && !isDropdown) {
            dropdownMenu.classList.add('hidden');
        }
    });

    function showContainer(containerToShow, activeButton) {
        unreadMessagesContainer.classList.add("hidden");
        ignoredMessagesContainer.classList.add("hidden");
        containerToShow.classList.remove("hidden");

        unreadButton.classList.remove("active");
        ignoredButton.classList.remove("active");

        activeButton.classList.add("active");
    }

    unreadButton.addEventListener("click", () => showContainer(unreadMessagesContainer, unreadButton));
    ignoredButton.addEventListener("click", () => showContainer(ignoredMessagesContainer, ignoredButton));


    async function deleteMessage(messageId, element) {
        try {
            const response = await fetch(`/api/delete_training_message/${messageId}/`, {
                method: 'GET',
            });

            const data = await response.json();

            if (data.error) {
                alert(data.error);
                return;
            }

            const messageItem = element.closest('.message-item');
            if (messageItem) {
                messageItem.remove();
            }

            // Обновляем счетчики
            const unreadIndicator = document.getElementById("unread-indicator");
            const ignoredIndicator = document.getElementById("ignored-indicator");

            unreadIndicator.textContent = data.unread_count;
            ignoredIndicator.textContent = data.ignored_count;

            // Показываем/скрываем индикаторы
            if (data.unread_count == 0) {
                unreadIndicator.classList.add("hidden");
            } else {
                unreadIndicator.classList.remove("hidden");
            }

            if (data.ignored_count == 0) {
                ignoredIndicator.classList.add("hidden");
            } else {
                ignoredIndicator.classList.remove("hidden");
            }

            // Проверяем, нужно ли показать сообщение "Нет сообщений"
            updateEmptyState();

        } catch (error) {
            console.error("Error:", error);
        }
    }

    async function ignoreMessage(messageId, button) {
        try {
            const response = await fetch(`/api/ignore_message/${messageId}/`, {
                method: 'GET',
            });

            const data = await response.json();

            if (data.error) {
                alert(data.error);
                return;
            }

            const messageItem = button.closest('.message-item');

            if (messageItem) {
                messageItem.remove();
                const ignoredContainer = document.getElementById("ignored-messages");
                ignoredContainer.appendChild(messageItem);
                const ignoreBtn = messageItem.querySelector('.btn-outline-warning');
                if (ignoreBtn) {
                    ignoreBtn.remove();
                }
            }

            // Обновляем счетчики
            const unreadIndicator = document.getElementById("unread-indicator");
            const ignoredIndicator = document.getElementById("ignored-indicator");

            unreadIndicator.textContent = data.unread_count;
            ignoredIndicator.textContent = data.ignored_count;

            // Показываем/скрываем индикаторы
            if (data.unread_count == 0) {
                unreadIndicator.classList.add("hidden");
            } else {
                unreadIndicator.classList.remove("hidden");
            }

            if (data.ignored_count == 0) {
                ignoredIndicator.classList.add("hidden");
            } else {
                ignoredIndicator.classList.remove("hidden");
            }

            // Проверяем, нужно ли показать сообщение "Нет сообщений"
            updateEmptyState();

        } catch (error) {
            console.error("Error:", error);
        }
    }

    // Функция для проверки и обновления состояния "Нет сообщений"
    function updateEmptyState() {
        const unreadContainer = document.getElementById("unread-messages");
        const ignoredContainer = document.getElementById("ignored-messages");

        // Проверяем неотвеченные сообщения
        if (unreadContainer.querySelectorAll('.message-item').length === 0) {
            if (!unreadContainer.querySelector('.empty-container')) {
                const emptyDiv = document.createElement('div');
                emptyDiv.className = 'empty-container d-flex justify-content-center';
                emptyDiv.innerHTML = '<p>Извините, в системе отсутствуют <br> <strong> Неотвеченные сообщения </strong></p>';
                unreadContainer.appendChild(emptyDiv);
            }
        } else {
            const emptyDiv = unreadContainer.querySelector('.empty-container');
            if (emptyDiv) {
                emptyDiv.remove();
            }
        }

        // Проверяем игнорированные сообщения
        if (ignoredContainer.querySelectorAll('.message-item').length === 0) {
            if (!ignoredContainer.querySelector('.empty-container')) {
                const emptyDiv = document.createElement('div');
                emptyDiv.className = 'empty-container d-flex justify-content-center';
                emptyDiv.innerHTML = '<p>Извините, в системе отсутствуют <br> <strong> Игнорируемые сообщения </strong></p>';
                ignoredContainer.appendChild(emptyDiv);
            }
        } else {
            const emptyDiv = ignoredContainer.querySelector('.empty-container');
            if (emptyDiv) {
                emptyDiv.remove();
            }
        }
    }

    const deleteButtons = document.querySelectorAll('.btn-outline-danger');
    deleteButtons.forEach(button => {
        button.addEventListener('click', async function() {
            const messageId = button.getAttribute('data-message-id');
            await deleteMessage(messageId, button);
        });
    });

    const ignoreButtons = document.querySelectorAll('.btn-outline-warning');
    ignoreButtons.forEach(button => {
        button.addEventListener('click', async function() {
            const messageId = button.getAttribute('data-message-id');
            await ignoreMessage(messageId, button);
        });
    });

    updateEmptyState();
});