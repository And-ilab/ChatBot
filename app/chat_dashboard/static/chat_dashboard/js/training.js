document.addEventListener("DOMContentLoaded", function () {
    const unreadMessagesContainer = document.getElementById("unread-messages");
    const ignoredMessagesContainer = document.getElementById("ignored-messages");
    const allMessagesContainer = document.getElementById("searched-messages");
    const unreadButton = document.getElementById("btn-unread");
    const ignoredButton = document.getElementById("btn-ignored");
    const searchedButton = document.getElementById("btn-searched");

    unreadMessagesContainer.classList.remove("hidden");
    unreadButton.classList.add("active");

    function showContainer(containerToShow, activeButton) {
        unreadMessagesContainer.classList.add("hidden");
        allMessagesContainer.classList.add("hidden");
        ignoredMessagesContainer.classList.add("hidden");
        containerToShow.classList.remove("hidden");

        unreadButton.classList.remove("active");
        ignoredButton.classList.remove("active");
        searchedButton.classList.remove("active");

        activeButton.classList.add("active");
    }

    unreadButton.addEventListener("click", () => showContainer(unreadMessagesContainer, unreadButton));
    ignoredButton.addEventListener("click", () => showContainer(ignoredMessagesContainer, ignoredButton));
    searchedButton.addEventListener("click", () => showContainer(allMessagesContainer, searchedButton));

    document.getElementById("search-button").addEventListener("click", function() {
        let inputText = document.getElementById("search-input").value.toLowerCase();
        let messageItems = document.querySelectorAll("#searched-messages .message-item");

        messageItems.forEach(function(item) {
            let messageContent = item.querySelector(".mb-0").textContent.toLowerCase();
            if (messageContent.includes(inputText)) {
                item.style.display = "flex";
            } else {
                item.style.display = "none";
            }
        });

        let visibleItems = Array.from(messageItems).some(item => item.style.display !== "none");
        console.log(visibleItems);
        const emptyContainer = document.getElementById("searched-empty");
        console.log(emptyContainer);

        searchedButton.style.display = 'flex';
        showContainer(allMessagesContainer, searchedButton);

        if (visibleItems) {
            emptyContainer.style.display = 'none';
        } else {
            emptyContainer.style.display = 'flex';
        }
    });

    function updateMessageActionButtons(messageItem, isIgnored) {
        const messageActions = messageItem.querySelector('.message-actions');
        const ignoreButton = messageActions.querySelector('[title="Игнорировать"], [title="Вернуть"]');
        const trainButton = messageActions.querySelector('[title="Обучить"]');
        const deleteButton = messageActions.querySelector('[title="Удалить"]');

        if (isIgnored) {
            ignoreButton.title = "Вернуть";
            ignoreButton.innerHTML = '<i class="bi bi-arrow-counterclockwise"></i>';
            ignoreButton.setAttribute('onclick', `toggleIgnoreBack(${messageItem.dataset.id}, this)`);
            trainButton.style.display = 'none';
        } else {
            ignoreButton.title = "Игнорировать";
            ignoreButton.innerHTML = '<i class="bi bi-slash-circle"></i>';
            ignoreButton.setAttribute('onclick', `toggleIgnore(${messageItem.dataset.id}, this)`);
            trainButton.style.display = 'inline-block';
        }

        // Показываем кнопку удалить
        deleteButton.style.display = 'inline-block';
    }

    function toggleIgnore(messageId, element) {
        fetch(`/api/toggle_ignore/${messageId}/`, {
            method: 'GET',
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
                return;
            }

            document.getElementById("unread-indicator").textContent = data.unread_count;
            document.getElementById("ignored-indicator").textContent = data.ignored_count;

            location.reload();
        })
        .catch(error => {
            console.error("Error:", error);
        });
    }

    function toggleIgnoreBack(messageId, element) {
        fetch(`/api/toggle_ignore_back/${messageId}/`, {
            method: 'GET',
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
                return;
            }

            document.getElementById("unread-indicator").textContent = data.unread_count;
            document.getElementById("ignored-indicator").textContent = data.ignored_count;

            location.reload();
        })
        .catch(error => {
            console.error("Error:", error);
        });
    }

    function deleteMessage(messageId, element) {
        fetch(`/api/delete_message/${messageId}/`, {
            method: 'GET',
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
                return;
            }

            // Убираем сообщение из DOM
            const messageItem = element.closest('.message-item');
            messageItem.remove();

            // Обновляем индикаторы
            document.getElementById("unread-indicator").textContent = data.unread_count;
            document.getElementById("ignored-indicator").textContent = data.ignored_count;
        })
        .catch(error => {
            console.error("Error:", error);
        });
    }

    const ignoreButtons = document.querySelectorAll('button[data-message-id]');
    ignoreButtons.forEach(button => {
        button.addEventListener('click', function() {
            const messageId = button.getAttribute('data-message-id');
            toggleIgnore(messageId, button);
        });
    });

    const deleteButtons = document.querySelectorAll('button[data-message-id][title="Удалить"]');
    deleteButtons.forEach(button => {
        button.addEventListener('click', function() {
            const messageId = button.getAttribute('data-message-id');
            deleteMessage(messageId, button);
        });
    });
});