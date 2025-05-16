const sectionSelect = document.getElementById('section');
const topicSelect = document.getElementById('topic');
const questionSelect = document.getElementById('question');
const documentList = document.getElementById('document-list');
const linkList = document.getElementById('link-list');

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `alert ${type} position-fixed top-0 start-50 translate-middle-x mt-3`;
    notification.innerText = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 2000);
}

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.startsWith('${name}=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

const fetchNodes = async (type) => {
    const encodedType = encodeURIComponent(type);
    try {
        const response = await fetch(`/api/get-nodes-by-type/?type=${encodedType}`, { method: 'GET' });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error fetching nodes: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data.result || [];
    } catch (error) {
        console.error('Error fetching nodes:', error.message);
        return [];
    }
};

const fetchNodesWithRelation = async (startNodeType, startNodeName, finishNodeType) => {
    const encodeStartNodeType = encodeURIComponent(startNodeType);
    const encodeStartNodeName = encodeURIComponent(startNodeName);
    const encodeFinishNodeType = encodeURIComponent(finishNodeType);
    try {
        const response = await fetch(`/api/get-nodes-by-type-with-relation/?startNodeType=${encodeStartNodeType}&startNodeName=${encodeStartNodeName}&finishNodeType=${encodeFinishNodeType}`, { method: 'GET' });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error fetching nodes: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data.result || [];
    } catch (error) {
        console.error('Error fetching nodes with relation:', error.message);
        return [];
    }
};

const fetchAnswer = async (questionId) => {
    const encodedQuestionId = encodeURIComponent(questionId);
    try {
        const response = await fetch(`/api/get-answer/?questionId=${encodedQuestionId}`, { method: 'GET' });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error fetching answer: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data.result[0];
    } catch (error) {
        console.error('Error fetching answer:', error.message);
        return '';
    }
};

const fetchDocuments = async (answerID) => {
    const encodedAnswerID = encodeURIComponent(answerID);
    try {
        const response = await fetch(`/api/get-artifacts/?answerID=${encodedAnswerID}`, { method: 'GET' });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error fetching documents: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data.result || [];
    } catch (error) {
        console.error('Error fetching documents:', error.message);
        return [];
    }
};

const fetchExistingLinks = async () => {
    try {
        const response = await fetch('/api/get-links/', { method: 'GET' });
        if (!response.ok) {
            throw new Error('Ошибка при загрузке ссылок');
        }
        const data = await response.json();
        return data.result || [];
    } catch (error) {
        console.error('Ошибка при загрузке ссылок:', error);
        return [];
    }
};

const fetchExistingDocuments = async () => {
    try {
        const response = await fetch('/api/get-documents/', { method: 'GET' });
        if (!response.ok) {
            throw new Error('Ошибка при загрузке документов');
        }
        const data = await response.json();
        return data.result || [];
    } catch (error) {
        console.error('Ошибка при загрузке документов:', error);
        return [];
    }
};

const updateDocumentList = (documents) => {
    const selectedQuestion = questionSelect.options[questionSelect.selectedIndex];
    if (!selectedQuestion || !selectedQuestion.value) {
        documentList.innerHTML = '<li class="list-group-item text-muted">Выберите вопрос для просмотра документов</li>';
        return;
    }

    documentList.innerHTML = '';

    if (documents.length === 0) {
        documentList.innerHTML = '<li class="list-group-item text-muted">Нет прикрепленных документов</li>';
        return;
    }

    documents.forEach((doc) => {
        const listItem = document.createElement('li');
        listItem.className = 'list-group-item d-flex justify-content-between align-items-center';

        listItem.innerHTML = `
            <span>${escapeHtml(doc.name)}</span>
            <div class="d-flex gap-2">
                ${doc.url ? `<a href="${doc.url}" class="btn btn-sm btn-outline-primary" download title="Скачать"><i class="bi bi-download"></i></a>` : ''}
                <button type="button" class="btn btn-sm btn-outline-danger delete-doc-btn"
                        data-id="${doc.id}" title="Удалить">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;

        documentList.appendChild(listItem);
    });

    document.querySelectorAll('.delete-doc-btn').forEach((button) => {
        button.addEventListener('click', async (event) => {
            if (!confirm('Вы уверены, что хотите удалить этот документ?')) return;

            const documentId = button.getAttribute('data-id');
            const answer = await fetchAnswer(selectedQuestion.value);
            const currentQuestion = questionSelect.options[questionSelect.selectedIndex];

            if (!currentQuestion || !currentQuestion.value) {
                showNotification('Не выбран вопрос', 'alert-danger');
                return;
            }

            try {
                const answer = await fetchAnswer(currentQuestion.value);
                if (!answer || !answer.id) throw new Error('Ответ не найден');

                const response = await fetch('/api/delete-relation/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCookie('csrftoken'),
                    },
                    body: JSON.stringify({ document_id: documentId, answer_id: answer.id }),
                });

                if (!response.ok) throw new Error(await response.text());

                await updateArtifacts(answer.id);
                showNotification('Документ удален', 'alert-success');

            } catch (error) {
                console.error('Ошибка удаления:', error);
                showNotification(`Ошибка удаления: ${error.message}`, 'alert-danger');
            }
        });
    });
};

// Вспомогательная функция для экранирования HTML
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

const updateLinkList = (links) => {
    linkList.innerHTML = '';
    const selectedQuestion = questionSelect.options[questionSelect.selectedIndex];

    if (!selectedQuestion || !selectedQuestion.value) {
        linkList.innerHTML = '<li class="list-group-item text-muted">Выберите вопрос для просмотра ссылок</li>';
        return;
    }

    if (links.length === 0) {
        linkList.innerHTML = '<li class="list-group-item text-muted">Нет прикрепленных ссылок</li>';
        return;
    }

    links.forEach((link) => {
        const listItem = document.createElement('li');
        listItem.className = 'list-group-item d-flex justify-content-between align-items-center';

        listItem.innerHTML = `
            <a href="${link.content}" target="_blank" rel="noopener noreferrer" title="Открыть ссылку">
                ${escapeHtml(link.name)}
            </a>
            <div class="d-flex gap-2">
                <button type="button" class="btn btn-sm btn-outline-danger delete-link-btn"
                        data-id="${link.id}" title="Удалить">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;

        linkList.appendChild(listItem);
    });

    document.querySelectorAll('.delete-link-btn').forEach((button) => {
        button.addEventListener('click', async (event) => {
            if (!confirm('Вы уверены, что хотите удалить этот документ?')) return;

            const linkId = button.getAttribute('data-id');
            const answer = await fetchAnswer(selectedQuestion.value);
            const currentQuestion = questionSelect.options[questionSelect.selectedIndex];

            if (!currentQuestion || !currentQuestion.value) {
                showNotification('Не выбран вопрос', 'alert-danger');
                return;
            }

            try {
                const answer = await fetchAnswer(currentQuestion.value);
                if (!answer || !answer.id) throw new Error('Ответ не найден');

                const response = await fetch('/api/delete-relation/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCookie('csrftoken'),
                    },
                    body: JSON.stringify({ document_id: linkId, answer_id: answer.id }),
                });

                if (!response.ok) throw new Error(await response.text());

                await updateArtifacts(answer.id);
                showNotification('Документ удален', 'alert-success');

            } catch (error) {
                console.error('Ошибка удаления:', error);
                showNotification(`Ошибка удаления: ${error.message}`, 'alert-danger');
            }
        });
    });
};



const populateExistingLinks = async () => {
    const existingLinkSelect = document.getElementById('existing-link');
    existingLinkSelect.innerHTML = '<option value="" disabled selected>Выберите ссылку</option>';

    try {
        const links = await fetchExistingLinks();
        links.forEach(link => {
            const option = document.createElement('option');
            option.value = link.id;
            option.textContent = link.name;
            existingLinkSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Ошибка при загрузке ссылок:', error);
    }
};

const populateDocumentSelect = async () => {
    const documentSelect = document.getElementById('existing-document');
    documentSelect.innerHTML = '<option value="" disabled selected>Выберите документ</option>';

    try {
        const documents = await fetchExistingDocuments();
        documents.forEach(doc => {
            const option = document.createElement('option');
            option.value = doc['id'];
            option.textContent = doc.name;
            documentSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Ошибка при заполнении списка документов:', error);
    }
};

const updateArtifacts = async (answer_id) => {
    const links = [];
    const documents = [];
    const documentsAndLinks = await fetchDocuments(answer_id);
    documentsAndLinks.forEach(element => {
        if (element.type === 'document') {
            documents.push(element);
        } else if (element.type === 'link') {
            links.push(element);
        }
    });
    updateDocumentList(documents);
    updateLinkList(links);
};

const clearLinkModal = () => {
    document.getElementById('link-title').value = '';
    document.getElementById('link-url').value = '';
    document.getElementById('existing-link').selectedIndex = 0;
    document.getElementById('selectExistingLink').checked = true;
    document.getElementById('existingLinkSection').style.display = 'block';
    document.getElementById('newLinkSection').style.display = 'none';
};

const clearDocumentModal = () => {
    document.getElementById('document-title').value = '';
    document.getElementById('document-file').value = '';
    document.getElementById('existing-document').selectedIndex = 0;
    document.getElementById('selectExistingDocument').checked = true;
    document.getElementById('existingDocumentSection').style.display = 'block';
    document.getElementById('newDocumentSection').style.display = 'none';
};

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        const bootstrapModal = bootstrap.Modal.getInstance(modal);
        if (bootstrapModal) {
            bootstrapModal.hide();
        }
    }

    if (modalId === "addDocumentModal") {
        clearDocumentModal();
    } else if (modalId === "addLinkModal") {
        clearLinkModal();
    }
}


document.addEventListener('DOMContentLoaded', async () => {
    const answerTextarea = document.getElementById('answer');
    const editAnswerButton = document.getElementById('edit-answer');
    const deleteAnswerButton = document.getElementById('delete-answer');
    const editQuestionButton = document.getElementById('edit-question');
    const editTopicButton = document.getElementById('edit-topic');
    const editSectionButton = document.getElementById('edit-section');
    const documentButton = document.getElementById('add-document');
    const linkButton = document.getElementById('add-link');

    const questionModal = new bootstrap.Modal(document.getElementById('editQuestionModal'));
    const topicModal = new bootstrap.Modal(document.getElementById('editTopicModal'));
    const sectionModal = new bootstrap.Modal(document.getElementById('editSectionModal'));

    const questionInput = document.getElementById('question-input');
    const topicInput = document.getElementById('topic-input');
    const sectionInput = document.getElementById('section-input');

    const saveQuestionButton = document.getElementById('save-question');
    const saveTopicButton = document.getElementById('save-topic');
    const saveSectionButton = document.getElementById('save-section');

    // Инициализация модальных окон
    const confirmDeleteSectionModal = new bootstrap.Modal(document.getElementById('confirmDeleteSectionModal'));
    const addSectionModal = new bootstrap.Modal(document.getElementById('addSectionModal'));
    const confirmDeleteTopicModal = new bootstrap.Modal(document.getElementById('confirmDeleteTopicModal'));
    const addTopicModal = new bootstrap.Modal(document.getElementById('addTopicModal'));
    const confirmDeleteQuestionModal = new bootstrap.Modal(document.getElementById('confirmDeleteQuestionModal'));
    const addQuestionModal = new bootstrap.Modal(document.getElementById('addQuestionModal'));

    try {
        const sections = await fetchNodes('Section');
        sectionSelect.innerHTML = '<option value="" disabled selected>Выберите раздел</option>';
        sections.forEach(section => {
            const option = document.createElement('option');
            option.value = section.id;
            option.textContent = section.name;
            sectionSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading sections:', error);
    }


    // Обработчик кнопки добавления раздела
    document.getElementById('add-section').addEventListener('click', () => {
        document.getElementById('new-section-name').value = '';
        addSectionModal.show();
    });

    // Обработчик кнопки сохранения нового раздела
    document.getElementById('save-new-section').addEventListener('click', async () => {
        const newSectionName = document.getElementById('new-section-name').value.trim();

        if (!newSectionName) {
            alert('Пожалуйста, введите название раздела');
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
                    class: 'Section',
                    name: '',
                    content: newSectionName,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                const option = document.createElement('option');
                option.value = data.data[0]['@rid'];
                option.textContent = newSectionName;
                sectionSelect.appendChild(option);
                sectionSelect.value = option.value;
                sectionSelect.dispatchEvent(new Event('change'));

                addSectionModal.hide();
                showNotification('Раздел успешно добавлен!', 'alert-success');
            } else {
                throw new Error('Ошибка при создании раздела');
            }
        } catch (error) {
            console.error('Ошибка при добавлении раздела:', error);
            addSectionModal.hide();
            showNotification('Ошибка при добавлении раздела', 'alert-danger');
        }
    });

     saveSectionButton.addEventListener('click', async () => {
        const updatedSection = sectionInput.value.trim();
        const selectedOption = sectionSelect.options[sectionSelect.selectedIndex];

        if (updatedSection && selectedOption && selectedOption.value) {
            try {
                const response = await fetch(`/api/update-section/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        sectionID: selectedOption.value,
                        content: updatedSection,
                    }),
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Ошибка при обновлении раздела: ${response.status} - ${errorText}`);
                }

                alert('Раздел успешно обновлен!');
                selectedOption.textContent = updatedSection;
                sectionModal.hide();
            } catch (error) {
                console.error('Ошибка при обновлении раздела:', error.message);
                alert('Ошибка при обновлении раздела.');
            }
        } else {
            alert('Пожалуйста, введите новое название раздела.');
        }
    });

    // Обработчик кнопки удаления раздела
    document.getElementById('delete-section').addEventListener('click', () => {
        const selectedOption = sectionSelect.options[sectionSelect.selectedIndex];

        if (!selectedOption || !selectedOption.value) {
            alert('Пожалуйста, выберите раздел для удаления');
            return;
        }

        // Устанавливаем название раздела в модальное окно
        document.getElementById('section-to-delete-name').textContent = selectedOption.textContent;
        confirmDeleteSectionModal.show();
    });

    // Обработчик подтверждения удаления раздела
    document.getElementById('confirm-delete-section').addEventListener('click', async () => {
        const selectedOption = sectionSelect.options[sectionSelect.selectedIndex];
        const sectionId = selectedOption.value;

        try {
            const response = await fetch('/api/delete-node/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken'),
                },
                body: JSON.stringify({
                    node_id: sectionId
                }),
            });

            if (response.ok) {
                sectionSelect.remove(selectedOption.index);

                if (sectionSelect.options.length <= 1) {
                    sectionSelect.selectedIndex = 0;
                    sectionSelect.dispatchEvent(new Event('change'));
                }

                topicSelect.innerHTML = '<option value="" disabled selected>Выберите тему</option>';
                questionSelect.innerHTML = '<option value="" disabled selected>Выберите вопрос</option>';
                answerTextarea.value = '';
                updateDocumentList([]);
                updateLinkList([]);

                confirmDeleteSectionModal.hide();
                showNotification('Раздел успешно удален!', 'alert-success');
            } else {
                throw new Error('Ошибка при удалении раздела');
            }
        } catch (error) {
            console.error('Ошибка при удалении раздела:', error);
            showNotification('Ошибка при удалении раздела', 'alert-danger');
        }
    });


    // Обработчики для тем
    document.getElementById('add-topic').addEventListener('click', () => {
        if (!sectionSelect.value) {
            alert('Пожалуйста, сначала выберите раздел');
            return;
        }
        document.getElementById('new-topic-name').value = '';
        addTopicModal.show();
    });

    document.getElementById('save-new-topic').addEventListener('click', async () => {
        const newTopicName = document.getElementById('new-topic-name').value.trim();
        const sectionId = sectionSelect.value;

        if (!newTopicName) {
            alert('Пожалуйста, введите название темы');
            return;
        }

        try {
            // Сначала создаем тему
            const createResponse = await fetch('/api/create-node/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken'),
                },
                body: JSON.stringify({
                    class: 'Topic',
                    name: '',
                    content: newTopicName,
                }),
            });

            if (createResponse.ok) {
                const createData = await createResponse.json();
                const topicId = createData.data[0]['@rid'];

                // Затем создаем связь с разделом
                const relationResponse = await fetch('/api/create-relation/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCookie('csrftoken'),
                    },
                    body: JSON.stringify({
                        start_node_id: sectionId,
                        end_node_id: topicId,
                    }),
                });

                if (relationResponse.ok) {
                    // Добавляем новую тему в select
                    const option = document.createElement('option');
                    option.value = topicId;
                    option.textContent = newTopicName;
                    topicSelect.appendChild(option);

                    // Выбираем новую тему
                    topicSelect.value = option.value;
                    topicSelect.dispatchEvent(new Event('change'));

                    addTopicModal.hide();
                    showNotification('Тема успешно добавлена!', 'alert-success');
                } else {
                    throw new Error('Ошибка при создании связи темы с разделом');
                }
            } else {
                throw new Error('Ошибка при создании темы');
            }
        } catch (error) {
            console.error('Ошибка при добавлении темы:', error);
            showNotification('Ошибка при добавлении темы', 'alert-danger');
        }
    });

    document.getElementById('delete-topic').addEventListener('click', () => {
        const selectedOption = topicSelect.options[topicSelect.selectedIndex];

        if (!selectedOption || !selectedOption.value) {
            alert('Пожалуйста, выберите тему для удаления');
            return;
        }

        document.getElementById('topic-to-delete-name').textContent = selectedOption.textContent;
        confirmDeleteTopicModal.show();
    });

    document.getElementById('confirm-delete-topic').addEventListener('click', async () => {
        const selectedOption = topicSelect.options[topicSelect.selectedIndex];
        const topicId = selectedOption.value;

        try {
            const response = await fetch('/api/delete-node/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken'),
                },
                body: JSON.stringify({
                    node_id: topicId
                }),
            });

            if (response.ok) {
                topicSelect.remove(selectedOption.index);

                if (topicSelect.options.length <= 1) {
                    topicSelect.selectedIndex = 0;
                    topicSelect.dispatchEvent(new Event('change'));
                }

                questionSelect.innerHTML = '<option value="" disabled selected>Выберите вопрос</option>';
                answerTextarea.value = '';
                updateDocumentList([]);
                updateLinkList([]);

                confirmDeleteTopicModal.hide();
                showNotification('Тема успешно удалена!', 'alert-success');
            } else {
                throw new Error('Ошибка при удалении темы');
            }
        } catch (error) {
            console.error('Ошибка при удалении темы:', error);
            showNotification('Ошибка при удалении темы', 'alert-danger');
        }
    });

    document.getElementById('add-question').addEventListener('click', () => {
        if (!topicSelect.value) {
            alert('Пожалуйста, сначала выберите тему');
            return;
        }
        document.getElementById('new-question-name').value = '';
        addQuestionModal.show();
    });

    document.getElementById('save-new-question').addEventListener('click', async () => {
        const newQuestionName = document.getElementById('new-question-name').value.trim();
        const topicId = topicSelect.value;

        if (!newQuestionName) {
            alert('Пожалуйста, введите текст вопроса');
            return;
        }

        try {
            const createResponse = await fetch('/api/create-node/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken'),
                },
                body: JSON.stringify({
                    class: 'Question',
                    name: '',
                    content: newQuestionName,
                }),
            });

            if (createResponse.ok) {
                const createData = await createResponse.json();
                const questionId = createData.data[0]['@rid'];

                // Затем создаем связь с темой
                const relationResponse = await fetch('/api/create-relation/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCookie('csrftoken'),
                    },
                    body: JSON.stringify({
                        start_node_id: topicId,
                        end_node_id: questionId,
                    }),
                });

                if (relationResponse.ok) {
                    // Добавляем новый вопрос в select
                    const option = document.createElement('option');
                    option.value = questionId;
                    option.textContent = newQuestionName;
                    questionSelect.appendChild(option);

                    // Выбираем новый вопрос
                    questionSelect.value = option.value;
                    questionSelect.dispatchEvent(new Event('change'));

                    addQuestionModal.hide();
                    showNotification('Вопрос успешно добавлен!', 'alert-success');
                } else {
                    throw new Error('Ошибка при создании связи вопроса с темой');
                }
            } else {
                throw new Error('Ошибка при создании вопроса');
            }
        } catch (error) {
            console.error('Ошибка при добавлении вопроса:', error);
            showNotification('Ошибка при добавлении вопроса', 'alert-danger');
        }
    });

    document.getElementById('delete-question').addEventListener('click', () => {
        const selectedOption = questionSelect.options[questionSelect.selectedIndex];

        if (!selectedOption || !selectedOption.value) {
            alert('Пожалуйста, выберите вопрос для удаления');
            return;
        }

        document.getElementById('question-to-delete-name').textContent = selectedOption.textContent;
        confirmDeleteQuestionModal.show();
    });

    document.getElementById('confirm-delete-question').addEventListener('click', async () => {
        const selectedOption = questionSelect.options[questionSelect.selectedIndex];
        const questionId = selectedOption.value;

        try {
            const response = await fetch('/api/delete-node/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken'),
                },
                body: JSON.stringify({
                    node_id: questionId
                }),
            });

            if (response.ok) {
                questionSelect.remove(selectedOption.index);

                if (questionSelect.options.length <= 1) {
                    questionSelect.selectedIndex = 0;
                    questionSelect.dispatchEvent(new Event('change'));
                }

                answerTextarea.value = '';
                updateDocumentList([]);
                updateLinkList([]);

                confirmDeleteQuestionModal.hide();
                showNotification('Вопрос успешно удален!', 'alert-success');
            } else {
                throw new Error('Ошибка при удалении вопроса');
            }
        } catch (error) {
            console.error('Ошибка при удалении вопроса:', error);
            showNotification('Ошибка при удалении вопроса', 'alert-danger');
        }
    });

    let isAnswerEditing = false;

    linkButton.addEventListener('click', async function() {
        await populateExistingLinks();
        clearLinkModal();
        var myModal = new bootstrap.Modal(document.getElementById('addLinkModal'));
        myModal.show();
    });

    documentButton.addEventListener('click', async function() {
        await populateDocumentSelect();
        clearDocumentModal();
        var myModal = new bootstrap.Modal(document.getElementById('addDocumentModal'));
        myModal.show();
    });

    editSectionButton.addEventListener('click', () => {
        const selectedOption = sectionSelect.options[sectionSelect.selectedIndex];
        if (selectedOption && selectedOption.value) {
            sectionInput.value = selectedOption.textContent.trim();
            sectionModal.show();
        } else {
            alert('Пожалуйста, выберите раздел для редактирования.');
        }
    });

    editTopicButton.addEventListener('click', () => {
        const selectedOption = topicSelect.options[topicSelect.selectedIndex];
        if (selectedOption && selectedOption.value) {
            topicInput.value = selectedOption.textContent.trim();
            topicModal.show();
        } else {
            alert('Пожалуйста, выберите тему для редактирования.');
        }
    });

    saveTopicButton.addEventListener('click', async () => {
        const selectedOption = topicSelect.options[topicSelect.selectedIndex];
        const updatedTopic = topicInput.value.trim();
        if (updatedTopic && selectedOption && selectedOption.value) {
            try {
                const response = await fetch(`/api/update-topic/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        topicID: selectedOption.value,
                        content: updatedTopic,
                    }),
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Ошибка при обновлении темы: ${response.status} - ${errorText}`);
                }

                alert('Тема успешно обновлена!');
                const updatedOption = topicSelect.querySelector(`option[value="${selectedOption.value}"]`);
                if (updatedOption) {
                    updatedOption.textContent = updatedTopic;
                }
                topicModal.hide();
            } catch (error) {
                console.error('Ошибка при обновлении темы:', error.message);
                alert('Ошибка при обновлении темы.');
            }
        } else {
            alert('Пожалуйста, введите новый текст темы.');
        }
    });

    editQuestionButton.addEventListener('click', () => {
        const selectedOption = questionSelect.options[questionSelect.selectedIndex];
        if (selectedOption && selectedOption.value) {
            questionInput.value = selectedOption.textContent.trim();
            questionModal.show();
        } else {
            alert('Пожалуйста, выберите вопрос для редактирования.');
        }
    });

    saveQuestionButton.addEventListener('click', async () => {
        // Получаем выбранный вопрос из select
        const selectedQuestion = questionSelect.options[questionSelect.selectedIndex];

        const updatedQuestion = questionInput.value.trim();

        if (!updatedQuestion) {
            showNotification('Пожалуйста, введите текст вопроса', 'alert-danger');
            return;
        }

        if (!selectedQuestion || !selectedQuestion.value) {
            showNotification('Не выбран вопрос для редактирования', 'alert-danger');
            return;
        }

        try {
            const response = await fetch(`/api/update-question/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken'), // Добавляем CSRF-токен
                },
                body: JSON.stringify({
                    questionID: selectedQuestion.value,
                    content: updatedQuestion,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Ошибка обновления вопроса');
            }

            showNotification('Вопрос успешно обновлен!', 'alert-success');

            // Обновляем текст в select
            selectedQuestion.textContent = updatedQuestion;
            questionModal.hide();

        } catch (error) {
            console.error('Ошибка обновления вопроса:', error);
            showNotification(`Ошибка: ${error.message}`, 'alert-danger');
        }
    });

    const selectExistingLink = document.getElementById('selectExistingLink');
    const addNewLink = document.getElementById('addNewLink');
    const existingLinkSection = document.getElementById('existingLinkSection');
    const newLinkSection = document.getElementById('newLinkSection');
    const saveDocumentButton = document.getElementById('save-document');
    const saveLinkButton = document.getElementById('save-link');

    if (selectExistingLink && addNewLink && existingLinkSection && newLinkSection) {
        selectExistingLink.addEventListener('change', function() {
            if (this.checked) {
                existingLinkSection.style.display = 'block';
                newLinkSection.style.display = 'none';
            }
        });

        addNewLink.addEventListener('change', function() {
            if (this.checked) {
                existingLinkSection.style.display = 'none';
                newLinkSection.style.display = 'block';
            }
        });
    }

    const selectExistingDocument = document.getElementById('selectExistingDocument');
    const addNewDocument = document.getElementById('addNewDocument');
    const existingDocumentSection = document.getElementById('existingDocumentSection');
    const newDocumentSection = document.getElementById('newDocumentSection');

    if (selectExistingDocument && addNewDocument && existingDocumentSection && newDocumentSection) {
        selectExistingDocument.addEventListener('change', function() {
            if (this.checked) {
                existingDocumentSection.style.display = 'block';
                newDocumentSection.style.display = 'none';
            }
        });

        addNewDocument.addEventListener('change', function() {
            if (this.checked) {
                existingDocumentSection.style.display = 'none';
                newDocumentSection.style.display = 'block';
            }
        });
    }

    saveDocumentButton.addEventListener("click", async (e) => {
        // Получаем текущий выбранный вопрос
        const selectedQuestion = questionSelect.options[questionSelect.selectedIndex];
        if (!selectedQuestion || !selectedQuestion.value) {
            showNotification('Пожалуйста, выберите вопрос', 'alert-danger');
            return;
        }

        const isNewDocument = document.getElementById('addNewDocument').checked;

        if (isNewDocument) {
            const formData = new FormData();
            const fileTitle = document.getElementById("document-title").value;
            const file = document.getElementById("document-file").files[0];

            if (!fileTitle || !file) {
                showNotification('Пожалуйста, заполните все поля', 'alert-danger');
                return;
            }
            formData.append("file",file);
            formData.append("title",fileTitle);

            try {
                // 1. Загружаем файл
                const uploadResponse = await fetch("/api/upload-document/", {
                    method: "POST",
                    body: formData,
                });

                if (!uploadResponse.ok) {
                    const error = await uploadResponse.json();
                    throw new Error(error.message || 'Ошибка загрузки файла');
                }

                const uploadResult = await uploadResponse.json();

                // 2. Получаем answerID для текущего вопроса
                const answer = await fetchAnswer(selectedQuestion.value);
                if (!answer || !answer.id) throw new Error('Ответ не найден');

                // 3. Создаем документ
                const docResponse = await fetch('/api/create-node/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X_CSRFTOKEN': getCookie('csrftoken'),
                    },
                    body: JSON.stringify({
                        class: 'document',
                        name: fileTitle,
                        content: fileTitle,
                        uuid: uploadResult.data.file_id
                    }),
                });

                if (!docResponse.ok) throw new Error('Ошибка создания документа');

                const docData = await docResponse.json();
                const docID = docData.data[0]['@rid'];

                // 4. Создаем связь
                await createRelation(answer.id, docID);

                // 5. Обновляем интерфейс
                await updateArtifacts(answer.id);
                showNotification('Документ добавлен!', 'alert-success');
                clearDocumentModal();
                closeModal("addDocumentModal");

            } catch (error) {
                console.error('Document error:', error);
                showNotification(`Ошибка: ${error.message}`, 'alert-danger');
            }
        } else {
            const selectedDocId = document.getElementById('existing-document').value;
            if (!selectedDocId) {
                showNotification('Выберите документ', 'alert-danger');
                return;
            }

            try {
                // Получаем answerID для текущего вопроса
                const answer = await fetchAnswer(selectedQuestion.value);
                if (!answer || !answer.id) throw new Error('Ответ не найден');

                // Создаем связь
                await createRelation(answer.id, selectedDocId);

                await updateArtifacts(answer.id);
                showNotification('Документ прикреплен!', 'alert-success');
                closeModal("addDocumentModal");

            } catch (error) {
                console.error('Attach document error:', error);
                showNotification(`Ошибка: ${error.message}`, 'alert-danger');
            }
        }
    });

    // Вспомогательная функция для создания связи
    async function createRelation(startId, endId) {
        const response = await fetch('/api/create-relation/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken'),
            },
            body: JSON.stringify({
                start_node_id: startId,
                end_node_id: endId,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            if (response.status === 409) {
                throw new Error('Связь уже существует');
            }
            throw new Error(errorData.message || 'Ошибка при создании связи');
        }
        return response;
    }

    saveLinkButton.addEventListener('click', async function () {
        // Получаем текущий выбранный вопрос
        const selectedQuestion = questionSelect.options[questionSelect.selectedIndex];
        if (!selectedQuestion || !selectedQuestion.value) {
            showNotification('Пожалуйста, выберите вопрос', 'alert-danger');
            return;
        }

        const isNewLink = document.getElementById('addNewLink').checked;

        try {
            // Получаем answerID для текущего вопроса
            const answer = await fetchAnswer(selectedQuestion.value);
            if (!answer || !answer.id) throw new Error('Ответ не найден');

            if (isNewLink) {
                const title = document.getElementById('link-title').value.trim();
                const url = document.getElementById('link-url').value.trim();

                if (!title || !url) {
                    showNotification('Заполните все поля', 'alert-danger');
                    return;
                }

                // Создаем ссылку
                const linkResponse = await fetch('/api/create-node/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X_CSRFTOKEN': getCookie('csrftoken'),
                    },
                    body: JSON.stringify({
                        class: 'link',
                        name: title,
                        content: url,
                    }),
                });

                if (!linkResponse.ok) {
                    const error = await linkResponse.json();
                    throw new Error(error.message || 'Ошибка создания ссылки');
                }

                const linkData = await linkResponse.json();
                const linkID = linkData.data[0]['@rid'];

                await createRelation(answer.id, linkID);
                await updateArtifacts(answer.id);
                showNotification('Ссылка добавлена!', 'alert-success');
                clearLinkModal();
                closeModal('addLinkModal');
            } else {
                const selectedLinkId = document.getElementById('existing-link').value;
                if (!selectedLinkId) {
                    showNotification('Выберите ссылку', 'alert-danger');
                    return;
                }

                await createRelation(answer.id, selectedLinkId);

                await updateArtifacts(answer.id);
                showNotification('Ссылка прикреплена!', 'alert-success');
                closeModal("addLinkModal");
            }

        } catch (error) {
            console.error('Link error:', error);
            const message = error.message.includes('уже существует')
                ? 'Связь уже существует'
                : `Ошибка: ${error.message}`;

            showNotification(message, error.message.includes('уже существует') ? 'alert-warning' : 'alert-danger');
        }
    });

    deleteAnswerButton.addEventListener('click', async () => {
        const selectedQuestion = questionSelect.options[questionSelect.selectedIndex];

        if (!selectedQuestion || !selectedQuestion.value) {
            alert('Пожалуйста, выберите вопрос');
            return;
        }

        try {
            const answer = await fetchAnswer(selectedQuestion.value);

            if (!answer || !answer.id) {
                throw new Error('Ответ для выбранного вопроса не найден');
            }

            const response = await fetch('/api/delete-node/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken'),
                },
                body: JSON.stringify({ node_id: answer.id }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error updating answer: ${response.status} - ${errorText}`);
            }

            answerTextarea.value = '';
            showNotification('Ответ успешно удален', 'alert-success');

        } catch (error) {
            console.error('Error deleting answer:', error.message);
            showNotification('Ошибка при удалении ответа: ' + error.message, 'alert-danger');
        }
    });


    editAnswerButton.addEventListener('click', async () => {
        const selectedQuestion = questionSelect.options[questionSelect.selectedIndex];
        if (!selectedQuestion || !selectedQuestion.value) {
            showNotification('Пожалуйста, выберите вопрос', 'alert-danger');
            return;
        }

        if (!isAnswerEditing) {
            // Режим редактирования
            isAnswerEditing = true;
            answerTextarea.removeAttribute('readonly');
            answerTextarea.classList.add('border', 'border-warning');
            editAnswerButton.innerHTML = '<i class="bi bi-check"></i>';
            editAnswerButton.classList.remove('btn-outline-warning');
            editAnswerButton.classList.add('btn-outline-success');
        } else {
            // Режим сохранения
            isAnswerEditing = false;
            const updatedContent = answerTextarea.value.trim();

            try {
                const response = await fetch(`/api/update-answer/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCookie('csrftoken'),
                    },
                    body: JSON.stringify({
                        questionID: selectedQuestion.value,
                        content: updatedContent,
                    }),
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || 'Ошибка сохранения ответа');
                }

                // Обновляем answerID если был создан новый ответ
                if (result.answerID) {
                    answerID = result.answerID;
                }

                showNotification(result.message, 'alert-success');

                // Обновляем интерфейс
                answerTextarea.setAttribute('readonly', 'readonly');
                answerTextarea.classList.remove('border', 'border-warning');
                editAnswerButton.innerHTML = '<i class="bi bi-pencil"></i>';
                editAnswerButton.classList.remove('btn-outline-success');
                editAnswerButton.classList.add('btn-outline-warning');

                // Обновляем артефакты (документы и ссылки)
                await updateArtifacts(answerID);

            } catch (error) {
                console.error('Error saving answer:', error);
                showNotification(`Ошибка: ${error.message}`, 'alert-danger');

                // Возвращаем в режим редактирования
                isAnswerEditing = true;
                answerTextarea.focus();
            }
        }
    });

    const isAllSelected = () => {
        return (
            sectionSelect.value &&
            topicSelect.value &&
            questionSelect.value
        );
    };

    sectionSelect.addEventListener('change', async (event) => {
        const selectedSectionName = event.target.options[event.target.selectedIndex].text;
        topicSelect.innerHTML = '<option value="" disabled selected>Выберите тему</option>';
        if (selectedSectionName) {
            try {
                const topics = await fetchNodesWithRelation('Section', selectedSectionName, 'Topic');
                topics.forEach(topic => {
                    const option = document.createElement('option');
                    option.value = topic.id;
                    option.textContent = topic.name;
                    topicSelect.appendChild(option);
                });
            } catch (error) {
                console.error('Error loading topics:', error);
            }
        }
    });

    topicSelect.addEventListener('change', async (event) => {
        const selectedTopicName = event.target.options[event.target.selectedIndex].text;
        questionSelect.innerHTML = '<option value="" disabled selected>Выберите вопрос</option>';
        if (selectedTopicName) {
            try {
                const questions = await fetchNodesWithRelation('Topic', selectedTopicName, 'Question');
                questions.forEach(question => {
                    const option = document.createElement('option');
                    option.value = question.id;
                    questionName = question.name;
                    option.textContent = question.name;
                    questionSelect.appendChild(option);
                });
            } catch (error) {
                console.error('Error loading questions:', error);
            }
        }
    });

    questionSelect.addEventListener('change', async (event) => {
        const selectedOption = event.target.options[event.target.selectedIndex];
        const questionId = selectedOption ? selectedOption.value : null;
        const answerTextarea = document.getElementById('answer');

        if (questionId) {
            try {
                const answer = await fetchAnswer(questionId);
                answerTextarea.value = answer.content;
                await updateArtifacts(answer.id);
            } catch (error) {
                console.error('Error loading answer and documents:', error);
                answerTextarea.value = 'Ответ не найден';
                updateDocumentList([]);
                updateLinkList([]);
            }
        } else {
            answerTextarea.value = '';
            updateDocumentList([]);
            updateLinkList([]);
        }
    });
});