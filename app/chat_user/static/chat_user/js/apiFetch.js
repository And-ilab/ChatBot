const BASE_API_URL = 'https://www.chatbot.digitranslab.com';

async function apiFetch(endpoint, options = {}) {
  const url = `${BASE_API_URL}${endpoint}`;
  const response = await fetch(url, options);

  if (response.ok) {
    const csrfToken = response.headers.get('X_CSRFTOKEN');
    if (csrfToken) {
      // Set the token in the cookies header
      document.cookie = `csrftoken=${csrfToken}; SameSite=None; Secure; Partitioned`;
    }
  }

  return response;
}

window.apiFetch = apiFetch;
