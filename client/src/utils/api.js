const backendOrigin = import.meta.env.VITE_BACKEND_ORIGIN ? import.meta.env.VITE_BACKEND_ORIGIN.replace(/\/$/, '') : '';
const API_BASE = backendOrigin ? `${backendOrigin}/api` : '/api';
async function handleResponse(res) {
  if (!res.ok) {
    const text = await res.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch (err) {
      payload = { error: text || res.statusText };
    }
    const error = new Error(payload.error || 'Request failed');
    error.status = res.status;
    error.payload = payload;
    throw error;
  }
  return res.json();
}

function buildHeaders(token) {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

export async function apiPost(path, body, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(body),
    mode: backendOrigin ? 'cors' : undefined
  });
  return handleResponse(res);
}

export async function apiGet(path, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    mode: backendOrigin ? 'cors' : undefined
  });
  return handleResponse(res);
}

export async function apiDelete(path, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    mode: backendOrigin ? 'cors' : undefined
  });
  return handleResponse(res);
}
