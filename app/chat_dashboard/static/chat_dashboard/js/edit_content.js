const sectionSelect = document.getElementById('section');
const topicSelect = document.getElementById('topic');
const questionSelect = document.getElementById('question');
const documentList = document.getElementById('document-list');
const linkList = document.getElementById('link-list');

let answerID;
let questionID;
let questionName;
let topicID;

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
        const response = await fetch(`/api/get-documents/?answerID=${encodedAnswerID}`, { method: 'GET' });

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

const updateDocumentList = (documents) => {
    documentList.innerHTML = '';
    documents.forEach((doc) => {
        const listItem = document.createElement('li');
        listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
        listItem.innerHTML = `
            <span>${doc.name}</span>
            <div class="d-flex gap-2">
                <button type="button" class="btn btn-sm btn-outline-danger">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;
        documentList.appendChild(listItem);
    });
};

const updateLinkList = (links) => {
    linkList.innerHTML = '';
    links.forEach((link) => {
        const listItem = document.createElement('li');
        listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
        listItem.innerHTML = `
            <span>${link.name}</span>
            <div class="d-flex gap-2">
                <button type="button" class="btn btn-sm btn-outline-danger">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;
        linkList.appendChild(listItem);
    });
};

document.addEventListener('DOMContentLoaded', async () => {
    const answerTextarea = document.getElementById('answer');
    const editAnswerButton = document.getElementById('edit-answer');
    const sectionSelect = document.getElementById('section');
    const topicSelect = document.getElementById('topic');
    const editQuestionButton = document.getElementById('edit-question');
    const questionSelect = document.getElementById('question');
    const modal = new bootstrap.Modal(document.getElementById('editQuestionModal'));
    const questionInput = document.getElementById('question-input');
    const saveButton = document.getElementById('save-question');

    let isAnswerEditing = false;

    document.getElementById('add-link').addEventListener('click', function() {
        var myModal = new bootstrap.Modal(document.getElementById('addLinkModal'));
        myModal.show();
    });

    document.getElementById('add-document').addEventListener('click', function() {
        var myModal = new bootstrap.Modal(document.getElementById('addDocumentModal'));
        myModal.show();
    });

    document.getElementById('save-link').addEventListener('click', async function () {
        let title = document.getElementById('link-title').value.trim();
        let url = document.getElementById('link-url').value.trim();
        let linkID;

        if (!title || !url) {
            alert('Пожалуйста, заполните все поля перед добавлением ссылки.');
            return;
        }

        try {
            const createLinkResponse = await fetch('/api/create-node/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken'),
                },
                body: JSON.stringify({
                    class: 'link',
                    name: title,
                    content: url,
                }),
            });

            if (createLinkResponse.ok) {
                const responseData = await createLinkResponse.json();
                console.log('Node created with ID:', responseData['data'][0]['@rid']);
                linkID = responseData['data'][0]['@rid'];
            } else {
                console.error('Failed to create node:', createLinkResponse.statusText);
            }
        } catch (error) {
            console.error('Error creating entity:', error);
        }

        try {
            const response = await fetch('/api/create-relation/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken'),
                },
                body: JSON.stringify({
                    start_node_id: answerID,
                    end_node_id: linkID,
                }),
            });
            if (response.status === 201) {
                alert('Cвязь успешно создана.');
            }
            else {
                console.error('Ошибка при создании связи:', await response.json());
                alert('Не удалось создать связь.');
            }
        } catch (error) {
            console.error('Ошибка при создании связи:', error);
        }

        document.getElementById('link-title').value = '';
        document.getElementById('link-url').value = '';
        var myModal = bootstrap.Modal.getInstance(document.getElementById('addLinkModal'));
        myModal.hide();
    });

    document.getElementById('save-document').addEventListener('click', function () {
        var title = document.getElementById('document-title').value.trim();
        var file = document.getElementById('document-file').files[0];

        // Проверка, что все поля заполнены
        if (!title || !file) {
            alert('Пожалуйста, заполните все поля перед добавлением документа.');
            return; // Прерываем выполнение, если есть незаполненные поля
        }

        // Отправка данных на сервер (реализуйте свою логику AJAX)
        console.log('Document added:', title, file);

        // Очистка полей и закрытие модального окна
        document.getElementById('document-title').value = '';
        document.getElementById('document-file').value = '';
        var myModal = bootstrap.Modal.getInstance(document.getElementById('addDocumentModal'));
        myModal.hide();
    });


    editAnswerButton.addEventListener('click', async () => {
        if (!isAnswerEditing) {
            isAnswerEditing = true;
            answerTextarea.removeAttribute('readonly');
            answerTextarea.classList.add('border', 'border-warning');
            editAnswerButton.innerHTML = '<i class="bi bi-check"></i>';
            editAnswerButton.classList.remove('btn-outline-warning');
            editAnswerButton.classList.add('btn-outline-success');
        } else {
            isAnswerEditing = false;
            const updatedContent = answerTextarea.value.trim();

            try {
                const response = await fetch(`/api/update-answer/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        answerID: answerID,
                        content: updatedContent,
                    }),
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Error updating answer: ${response.status} - ${errorText}`);
                }
                console.log('Answer updated successfully!');
            } catch (error) {
                console.error('Error updating answer:', error.message);
                alert('Ошибка при обновлении ответа. Проверьте подключение к серверу.');
            }

            answerTextarea.setAttribute('readonly', 'readonly');
            answerTextarea.classList.remove('border', 'border-warning');
            editAnswerButton.innerHTML = '<i class="bi bi-pencil"></i>'; // Вернуть иконку карандаша
            editAnswerButton.classList.remove('btn-outline-success');
            editAnswerButton.classList.add('btn-outline-warning');
        }
    });


    editQuestionButton.addEventListener('click', () => {
        const selectedOption = questionSelect.options[questionSelect.selectedIndex];
        if (selectedOption) {
            selectedQuestionId = selectedOption.value;
            questionInput.value = selectedOption.textContent.trim();
            modal.show();
        } else {
            alert('Пожалуйста, выберите вопрос для редактирования.');
        }
    });
    
    saveButton.addEventListener('click', async () => {
        const updatedQuestion = questionInput.value.trim();
        if (updatedQuestion && selectedQuestionId) {
            try {
                const response = await fetch(`/api/update-question/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        questionID: questionID,
                        content: updatedQuestion,
                    }),
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Ошибка при обновлении вопроса: ${response.status} - ${errorText}`);
                }

                alert('Вопрос успешно обновлен!');
                const updatedOption = questionSelect.querySelector(`option[value="${selectedQuestionId}"]`);
                if (updatedOption) {
                    updatedOption.textContent = updatedQuestion;
                }
                modal.hide();
            } catch (error) {
                console.error('Ошибка при обновлении вопроса:', error.message);
                alert('Ошибка при обновлении вопроса.');
            }
        } else {
            alert('Пожалуйста, введите новый текст вопроса.');
        }
    });


    // Функция проверки выбора селектов
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
                    topicID = topic.id;
                    option.value = topicID;
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
                    questionID = question.id;
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
        const selectedQuestionId = event.target.value;
        const answerTextarea = document.getElementById('answer');
        if (selectedQuestionId) {
            try {
                const links = [];
                const documents = [];
                const answer = await fetchAnswer(selectedQuestionId);
                answerTextarea.value = answer.content;
                answerID = answer.id;
                const documentsAndLinks = await fetchDocuments(answer.id);
                console.log(documentsAndLinks)
                documentsAndLinks.forEach(element => {
                    if (element.type === 'document') {
                        documents.push(element);
                    } else if (element.type === 'link') {
                        links.push(element);
                    }
                });
                console.log(links);
                updateDocumentList(documents);
                updateLinkList(links);
            } catch (error) {
                console.error('Error loading answer and documents:', error);
                answerTextarea.value = 'Ошибка при загрузке ответа';
                updateDocumentList([]);
                updateLinkList([]);
            }
        } else {
            answerTextarea.value = '';
            updateDocumentList([]);
            updateLinkList([]);
        }
    });

    [sectionSelect, topicSelect, questionSelect].forEach((select) => {
        select.addEventListener('change', () => {
            if (isAllSelected()) {
                editAnswerButton.removeAttribute('disabled');
                editQuestionButton.removeAttribute('disabled');
            } else {
                editAnswerButton.setAttribute('disabled', 'true');
                editQuestionButton.setAttribute('disabled', 'true');
            }
        });
    });

    editAnswerButton.setAttribute('disabled', 'true');
    editQuestionButton.setAttribute('disabled', 'true');
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
});