const BASE_API_URL = 'https://www.chatbot.digitranslab.com';
async function apiFetch(endpoint, options = {}) {
    const url = `${BASE_API_URL}${endpoint}`;
    const response = await fetch(url, options);
    return response;
  }