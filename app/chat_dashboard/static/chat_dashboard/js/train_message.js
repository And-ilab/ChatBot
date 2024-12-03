document.addEventListener('DOMContentLoaded', async function () {
    // Получение текста из инпута
    const input = document.getElementById('train-input').value;

    // Запрос на выделение ключевых слов
    try {
        const keywordsResponse = await fetch('/api/extract-keywords/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken'),
            },
            body: JSON.stringify({ question: input }),
        });

        if (keywordsResponse.ok) {
            const data = await keywordsResponse.json();
            const keywordsList = document.getElementById('keywords-list');
            keywordsList.textContent = data.keywords.join(', ');
        } else {
            console.error('Ошибка при выделении ключевых слов:', await keywordsResponse.text());
            alert('Не удалось выделить ключевые слова.');
        }
    } catch (error) {
        console.error('Ошибка при запросе ключевых слов:', error);
    }

    // Обработчики для модального окна создания сущности
    const createEntityButton = document.querySelector("#create-entity-button");
    const entityModal = document.querySelector("#entity-modal");
    const closeEntityButton = entityModal.querySelector(".modal-close-button");

    if (createEntityButton && entityModal) {
        createEntityButton.addEventListener("click", () => {
            entityModal.style.display = "flex";
        });

        closeEntityButton.addEventListener("click", () => {
            entityModal.style.display = "none";
        });
    }

    // Обработчики для модального окна создания связи
    const createRelationButton = document.querySelector("#create-relation-button");
    const relationModal = document.querySelector("#relation-modal");
    const closeRelationButton = relationModal.querySelector(".modal-close-button");
    const startNodeSelect = document.getElementById('start-node');
    const endNodeSelect = document.getElementById('end-node');

    if (createRelationButton && relationModal) {
        createRelationButton.addEventListener("click", async () => {
            const spinner = document.getElementById("loading-spinner");
            const form = document.getElementById("create-relation-form");
            try {
                // Показать спиннер и скрыть форму
                relationModal.style.display = "flex";
                spinner.style.display = "flex";
                form.style.display = "none";

                // Получение данных
                const nodesResponse = await fetch('/api/get-nodes/');
                if (nodesResponse.ok) {
                    const nodes = await nodesResponse.json();
                    // Очистка и заполнение селектов
                    startNodeSelect.innerHTML = '';
                    endNodeSelect.innerHTML = '';
                    nodes.forEach(node => {
                        const option = document.createElement('option');
                        option.value = node.id;
                        option.textContent = `${node.type}: ${node.name}`;
                        startNodeSelect.appendChild(option.cloneNode(true));
                        endNodeSelect.appendChild(option);
                    });
                } else {
                    console.error('Ошибка при получении узлов:', await nodesResponse.text());
                    alert('Не удалось загрузить сущности.');
                }
            } catch (error) {
                console.error('Ошибка при загрузке узлов:', error);
            } finally {
                spinner.style.display = "none";
                form.style.display = "flex";
            }
        });

        closeRelationButton.addEventListener("click", () => {
            relationModal.style.display = "none";
        });
    }

    // Эмодзи-панель
    const emojiButton = document.getElementById('insert-emoji');
    const emojiContainer = document.getElementById('emoji-container');
    const nodeContent = document.getElementById('node-content');

    emojiButton.addEventListener('click', () => {
        const isVisible = emojiContainer.style.display === 'flex';
        emojiContainer.style.display = isVisible ? 'none' : 'flex';
    });

    emojiContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('emoji')) {
            const emoji = event.target.getAttribute('data-emoji');
            nodeContent.value += emoji;
            emojiContainer.style.display = 'none';
        }
    });

    document.addEventListener('click', (event) => {
        if (!emojiContainer.contains(event.target) && event.target !== emojiButton) {
            emojiContainer.style.display = 'none';
        }
    });

    // Создание узла
    document.getElementById('create-node-btn').addEventListener('click', async function () {
        const nodeType = document.getElementById('node-type').value;
        const nodeName = document.getElementById('node-name').value;
        const nodeContent = document.getElementById('node-content').value;

        if (!nodeType || !nodeName) {
            alert('Пожалуйста, заполните все поля.');
            return;
        }

        try {
            const response = await fetch('/api/create-node/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken'),
                },
                body: JSON.stringify({
                    type: nodeType,
                    name: nodeName,
                    content: nodeContent,
                }),
            });

            if (response.status === 201) {
                document.getElementById('node-type').value = '';
                document.getElementById('node-name').value = '';
                document.getElementById('node-content').value = '';
                alert("Сущность успешно создана");
            } else {
                console.error('Ошибка при создании узла:', await response.json());
                alert('Не удалось создать сущность.');
            }
        } catch (error) {
            console.error('Ошибка при создании сущности:', error);
        }
    });

    // Создание связи
    document.getElementById('create-relation-btn').addEventListener('click', async function () {
        const relationType = document.getElementById('relation-type').value;
        const startNodeId = document.getElementById('start-node').value;
        const endNodeId = document.getElementById('end-node').value;

        if (!relationType || !startNodeId || !endNodeId) {
            alert('Пожалуйста, заполните все поля.');
            return;
        }

        try {
            const response = await fetch('/api/create-relation/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken'),
                },
                body: JSON.stringify({
                    type: relationType,
                    start_node_id: startNodeId,
                    end_node_id: endNodeId,
                }),
            });

            if (response.status === 201) {
                document.getElementById('relation-type').value = '';
                alert("Связь успешно создана");
            } else {
                console.error('Ошибка при создании связи:', await response.json());
                alert('Не удалось создать связь.');
            }
        } catch (error) {
            console.error('Ошибка при создании связи:', error);
        }
    });
});

// Функция получения CSRF-токена
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.startsWith(`${name}=`)) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}
