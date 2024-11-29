document.addEventListener('DOMContentLoaded', async function () {
    const input = document.getElementById('train-input').value;

    const keywords_response = await fetch('/api/extract-keywords/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken'),
        },
        body: JSON.stringify({ question: input }),
    });

    if (keywords_response.ok) {
        const data = await keywords_response.json();
        const keywordsList = document.getElementById('keywords-list');

        keywordsList.innerHTML = '';
        keywordsList.textContent = data.keywords.join(', ');
    } else {
        alert('Ошибка при выделении ключевых слов');
    }

    const startNodeSelect = document.getElementById('start-node');
    const endNodeSelect = document.getElementById('end-node');

    const nodes_response = await fetch('/api/get-nodes/');
    const nodes = await nodes_response.json();

    console.log(nodes);

    nodes.forEach(node => {
        const option = document.createElement('option');
        option.value = node.id;
        option.textContent = `${node.type}: ${node.content}`;
        startNodeSelect.appendChild(option.cloneNode(true));
        endNodeSelect.appendChild(option);
    });
});

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

document.getElementById('create-node-btn').addEventListener('click', async function () {
    const nodeType = document.getElementById('node-type').value;
    const nodeContent = document.getElementById('node-content').value;

    if (!nodeType) {
        alert('Пожалуйста, введите тип узла.');
        return;
    }

    if (!nodeContent) {
        alert('Пожалуйста, укажите содержимое узла.');
        return;
    }

    console.log('Тип узла:', nodeType);
    console.log('Содержимое узла:', nodeContent);

    const requestBody = JSON.stringify({
        type: nodeType,
        content: nodeContent
    });

    console.log('Отправляемые данные:', requestBody);

    const response = await fetch('/api/create-node/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken'),
        },
        body: requestBody
    });

    console.log("Response status:", response.status);

    if (response.status === 201) {
        const data = await response.json();
        document.getElementById('node-type').value = '';
        document.getElementById('node-content').value = '';
    } else {
        const errorData = await response.json();
        console.log("Error data:", errorData);
        alert('Ошибка при создании узла');
    }
});

document.getElementById('create-relation-btn').addEventListener('click', async function () {
    const relationType = document.getElementById('relation-type').value;
    const startNodeId = document.getElementById('start-node').value;
    const endNodeId = document.getElementById('end-node').value;

    if (!relationType) {
        alert('Пожалуйста, введите тип связи.');
        return;
    }

    if (!startNodeId || !endNodeId) {
        alert('Пожалуйста, выберите начальную и конечную сущности.');
        return;
    }

    console.log('Тип связи:', relationType);
    console.log('Начальная сущность ID:', startNodeId);
    console.log('Конечная сущность ID:', endNodeId);

    const requestBody = JSON.stringify({
        type: relationType,
        start_node_id: startNodeId,
        end_node_id: endNodeId
    });

    try {
        const response = await fetch('/api/create-relation/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken'),
            },
            body: requestBody
        });

        if (response.status === 201) {
            document.getElementById('relation-type').value = '';
        } else {
            const errorData = await response.json();
            console.error('Ошибка при создании связи:', errorData);
            alert('Ошибка при создании связи');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Произошла ошибка');
    }
});