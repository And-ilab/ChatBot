const sectionSelect = document.getElementById('section');
const topicSelect = document.getElementById('topic');
const questionSelect = document.getElementById('question');
const documentList = document.getElementById('document-list');

let answerID;
let questionID;

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
                <button type="button" class="btn btn-sm btn-outline-warning">
                    <i class="bi bi-pencil"></i>
                </button>
                <button type="button" class="btn btn-sm btn-outline-danger">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;
        documentList.appendChild(listItem);
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
                    questionID = question.id;
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
                const documents = await fetchDocuments(answer.id);
                updateDocumentList(documents);
            } catch (error) {
                console.error('Error loading answer and documents:', error);
                answerTextarea.value = 'Ошибка при загрузке ответа';
                updateDocumentList([]);
            }
        } else {
            answerTextarea.value = '';
            updateDocumentList([]);
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