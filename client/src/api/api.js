const BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(method, path, body, isFormData = false) {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData && body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body
      ? isFormData
        ? body
        : JSON.stringify(body)
      : undefined,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error en la solicitud');
  return data;
}

// Auth
export const api = {
  auth: {
    register: (body) => request('POST', '/auth/register', body),
    login: (body) => request('POST', '/auth/login', body),
    me: () => request('GET', '/auth/me'),
  },
  inventory: {
    getRooms: () => request('GET', '/inventory/rooms'),
    createRoom: (body) => request('POST', '/inventory/rooms', body),
    deleteRoom: (id) => request('DELETE', `/inventory/rooms/${id}`),

    getItems: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('GET', `/inventory/items${qs ? '?' + qs : ''}`);
    },
    createItem: (formData) => request('POST', '/inventory/items', formData, true),
    updateItem: (id, formData) => request('PUT', `/inventory/items/${id}`, formData, true),
    deleteItem: (id) => request('DELETE', `/inventory/items/${id}`),
  },
  books: {
    lookupIsbn: (isbn) => request('GET', `/books/isbn/${isbn}`),

    getLibraries: () => request('GET', '/books/libraries'),
    createLibrary: (body) => request('POST', '/books/libraries', body),
    deleteLibrary: (id) => request('DELETE', `/books/libraries/${id}`),

    getBooks: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('GET', `/books${qs ? '?' + qs : ''}`);
    },
    createBook: (body) => request('POST', '/books', body),
    updateBook: (id, body) => request('PUT', `/books/${id}`, body),
    deleteBook: (id) => request('DELETE', `/books/${id}`),
  },
};
