const BASE_API_URL = 'https://www.chatbot.digitranslab.com';

function apiFetch(endpoint, options = {}) {
  const url = `${BASE_API_URL}${endpoint}`;
  return fetch(url, options);
}

window.apiFetch = apiFetch;
