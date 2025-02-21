const sectionSelect = document.getElementById('section');
const topicSelect = document.getElementById('topic');
const questionSelect = document.getElementById('question');
const documentList = document.getElementById('document-list');
const linkList = document.getElementById('link-list');

let answerID;
let questionID;
let questionName;
let topicID;


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

const updateDocumentList = (documents) => {
    documentList.innerHTML = '';
    documents.forEach((doc) => {
        const listItem = document.createElement('li');
        listItem.className = 'list-group-item d-flex justify-content-between align-items-center';

        listItem.innerHTML = `
            <span>${doc.name}</span>
            <div class="d-flex gap-2">
                <button
                    type="button"
                    class="btn btn-sm btn-outline-danger delete-doc-btn"
                    data-id="${doc.id}">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;

        documentList.appendChild(listItem);
    });

    const deleteButtons = document.querySelectorAll('.delete-doc-btn');
    deleteButtons.forEach((button) => {
        button.addEventListener('click', async (event) => {
            const documentId = button.getAttribute('data-id');
            try {
                const response = await fetch(`/api/delete-node/`, {
                    method: 'POST',
                    body: JSON.stringify({
                        node_id: documentId
                    }),
                });

                if (response.ok) {
                    console.log(`Документ с ID ${documentId} удалён.`);
                    await updateArtifacts(answerID);
                } else {
                    console.error(`Ошибка при удалении документа с ID ${documentId}`);
                }
            } catch (error) {
                console.error(`Ошибка при попытке удалить документ с ID ${documentId}:`, error);
            }
        });
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
                <button
                    type="button"
                    class="btn btn-sm btn-outline-danger delete-link-btn"
                    data-id="${link.id}">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;
        linkList.appendChild(listItem);
    });

    const deleteButtons = document.querySelectorAll('.delete-link-btn');
    deleteButtons.forEach((button) => {
        button.addEventListener('click', async (event) => {
            const linkId = button.getAttribute('data-id');
            try {
                const response = await fetch(`/api/delete-node/`, {
                    method: 'POST',
                    body: JSON.stringify({
                        node_id: linkId
                    }),
                });

                if (response.ok) {
                    console.log(`Ссылка с ID ${linkId} удалена.`);
                    await updateArtifacts(answerID);
                } else {
                    console.error(`Ошибка при удалении ссылки с ID ${linkId}`);
                }
            } catch (error) {
                console.error(`Ошибка при попытке удалить ссылку с ID ${linkId}:`, error);
            }
        });
    });
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


document.addEventListener('DOMContentLoaded', async () => {
    const answerTextarea = document.getElementById('answer');
    const editAnswerButton = document.getElementById('edit-answer');
    const deleteAnswerButton = document.getElementById('delete-answer');
    const sectionSelect = document.getElementById('section');
    const topicSelect = document.getElementById('topic');
    const editQuestionButton = document.getElementById('edit-question');
    const questionSelect = document.getElementById('question');
    const modal = new bootstrap.Modal(document.getElementById('editQuestionModal'));
    const questionInput = document.getElementById('question-input');
    const saveButton = document.getElementById('save-question');
    const addDocumentButton = document.getElementById('save-document');
    const documentButton = document.getElementById('add-document');
    const linkButton = document.getElementById('add-link');

    let isAnswerEditing = false;

    document.getElementById('add-link').addEventListener('click', function() {
        var myModal = new bootstrap.Modal(document.getElementById('addLinkModal'));
        myModal.show();
    });

    document.getElementById('add-document').addEventListener('click', function() {
        var myModal = new bootstrap.Modal(document.getElementById('addDocumentModal'));
        myModal.show();
    });

    addDocumentButton.addEventListener("click", async (e) => {
        const formData = new FormData();
        const fileTitle = document.getElementById("document-title").value;
        const file = document.getElementById("document-file").files[0];
        const fileName = file.name;
        let documentID;


        formData.append("title", fileTitle);
        formData.append("file", file);

        try {
            const response = await fetch("/api/upload-document/", {
                method: "POST",
                body: formData,
            });

            if (response.ok) {
                const result = await response.json();

                try {
                    const createDocumentResponse = await fetch('/api/create-node/', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': getCookie('csrftoken'),
                        },
                        body: JSON.stringify({
                            class: 'document',
                            name: fileTitle,
                            content: '',
                            uuid: result.data.file_id
                        }),
                    });

                    const responseData = await createDocumentResponse.json();
                    console.log('Node created with ID:', responseData['data'][0]['@rid']);
                    documentID = responseData['data'][0]['@rid'];

                    console.log(answerID, documentID);

                    try {
                        const createRelationResponse = await fetch('/api/create-relation/', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-CSRFToken': getCookie('csrftoken'),
                            },
                            body: JSON.stringify({
                                start_node_id: answerID,
                                end_node_id: documentID,
                            }),
                        });
                        if (createRelationResponse.status === 201) {
                            await updateArtifacts(answerID);
                        }
                        else {
                            console.error('Ошибка при создании связи:', await createRelationResponse.json());
                            alert('Не удалось создать связь.');
                        }
                    } catch (error) {
                        console.error('Ошибка при создании связи:', error);
                    }
                } catch (error) {
                    console.error('Error creating entity:', error);
                }

                const modal = bootstrap.Modal.getInstance(document.getElementById("addDocumentModal"));
                document.getElementById("document-title").value= '';
                document.getElementById("document-file").value = '';
                modal.hide();
            } else {
                console.error("Ошибка при загрузке файла.");
            }
        } catch (error) {
            console.error("Произошла ошибка:", error);
        }
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
                await updateArtifacts(answerID);
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

    deleteAnswerButton.addEventListener('click', async () => {
        try {
            const response = await fetch(`/api/update-answer/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    answerID: answerID,
                    content: '',
                }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error updating answer: ${response.status} - ${errorText}`);
            }
            answerTextarea.value = '';
        } catch (error) {
            console.error('Error updating answer:', error.message);
            alert('Ошибка при обновлении ответа. Проверьте подключение к серверу.');
        }
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
                const answer = await fetchAnswer(selectedQuestionId);
                answerTextarea.value = answer.content;
                answerID = answer.id;
                await updateArtifacts(answerID);

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
                documentButton.removeAttribute('disabled');
                linkButton.removeAttribute('disabled');
                deleteAnswerButton.removeAttribute('disabled');
            } else {
                editAnswerButton.setAttribute('disabled', 'true');
                editQuestionButton.setAttribute('disabled', 'true');
                documentButton.setAttribute('disabled', 'true');
                linkButton.setAttribute('disabled', 'true');
                deleteAnswerButton.setAttribute('disabled', 'true');
            }
        });
    });

    editAnswerButton.setAttribute('disabled', 'true');
    deleteAnswerButton.setAttribute('disabled', 'true');
    editQuestionButton.setAttribute('disabled', 'true');
    documentButton.setAttribute('disabled', 'true');
    linkButton.setAttribute('disabled', 'true');
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

