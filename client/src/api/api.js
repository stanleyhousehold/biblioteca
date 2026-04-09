const BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(method, urlPath, body, isFormData = false) {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData && body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers,
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error en la solicitud');
  return data;
}

export const api = {
  auth: {
    register: (body) => request('POST', '/auth/register', body),
    login: (body) => request('POST', '/auth/login', body),
    me: () => request('GET', '/auth/me'),
    updateProfile: (body) => request('PUT', '/auth/profile', body),
    uploadProfilePhoto: (fd) => request('PUT', '/auth/profile/photo', fd, true),
    forgotPassword: (body) => request('POST', '/auth/forgot-password', body),
    resetPassword: (body) => request('POST', '/auth/reset-password', body),
  },

  households: {
    list: () => request('GET', '/households'),
    create: (body) => request('POST', '/households', body),
    get: (id) => request('GET', `/households/${id}`),
    update: (id, body) => request('PUT', `/households/${id}`, body),
    delete: (id) => request('DELETE', `/households/${id}`),
    invite: (id) => request('POST', `/households/${id}/invite`),
    join: (token) => request('POST', `/households/join/${token}`),
    removeMember: (id, userId) => request('DELETE', `/households/${id}/members/${userId}`),
  },

  inventory: {
    getRooms: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('GET', `/inventory/rooms${qs ? '?' + qs : ''}`);
    },
    createRoom: (body) => request('POST', '/inventory/rooms', body),
    updateRoom: (id, body) => request('PUT', `/inventory/rooms/${id}`, body),
    deleteRoom: (id) => request('DELETE', `/inventory/rooms/${id}`),

    getItems: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('GET', `/inventory/items${qs ? '?' + qs : ''}`);
    },
    createItem: (fd) => request('POST', '/inventory/items', fd, true),
    updateItem: (id, fd) => request('PUT', `/inventory/items/${id}`, fd, true),
    deleteItem: (id) => request('DELETE', `/inventory/items/${id}`),
  },

  books: {
    lookupIsbn: (isbn) => request('GET', `/books/isbn/${isbn}`),

    getLibraries: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('GET', `/books/libraries${qs ? '?' + qs : ''}`);
    },
    createLibrary: (body) => request('POST', '/books/libraries', body),
    updateLibrary: (id, body) => request('PUT', `/books/libraries/${id}`, body),
    deleteLibrary: (id) => request('DELETE', `/books/libraries/${id}`),

    getBooks: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('GET', `/books${qs ? '?' + qs : ''}`);
    },
    createBook: (fd) => request('POST', '/books', fd, true),
    updateBook: (id, fd) => request('PUT', `/books/${id}`, fd, true),
    deleteBook: (id) => request('DELETE', `/books/${id}`),
  },

  export: {
    download: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('GET', `/export${qs ? '?' + qs : ''}`);
    },
    import: (body) => request('POST', '/export/import', body),
  },

  recent: {
    get: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('GET', `/recent${qs ? '?' + qs : ''}`);
    },
  },
};
