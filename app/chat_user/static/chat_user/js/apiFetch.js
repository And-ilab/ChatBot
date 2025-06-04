const BASE_API_URL = 'https://www.chatbot.digitranslab.com';

async function apiFetch(endpoint, options = {}) {
  const url = `${BASE_API_URL}${endpoint}`;
  const response = await fetch(url, options);

  // Extract and set the CSRF token cookie regardless of response status
  const csrfToken = response.headers.get('X_CSRFTOKEN');
  if (csrfToken) {
    document.cookie = `csrftoken=${csrfToken}; SameSite=None; Secure; Partitioned`;
  }

  return response; // Return the response object as is
}

window.apiFetch = apiFetch;