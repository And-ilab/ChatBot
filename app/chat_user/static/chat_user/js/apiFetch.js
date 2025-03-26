const BASE_API_URL = 'https://www.chatbot.digitranslab.com';

async function apiFetch(endpoint, options = {}) {
  const url = `${BASE_API_URL}${endpoint}`;
  const response = await fetch(url, options);
  if (response.ok) {
    const cookies = response.headers.get('Set-Cookie');
    if (cookies && cookies.includes('csrftoken')) {
      response.headers['Set-Cookie'] = cookies.replace(
        'csrftoken',
        'csrftoken; SameSite=None; Secure; Partitioned'
      );
    }
  }
  return response;
}

window.apiFetch = apiFetch;
