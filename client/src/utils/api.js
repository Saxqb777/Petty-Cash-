const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  // Records
  getRecords: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return request(`/records${qs ? `?${qs}` : ''}`);
  },
  getRecord: (id) => request(`/records/${id}`),
  createRecord: (data) => request('/records', { method: 'POST', body: JSON.stringify(data) }),
  updateRecord: (id, data) => request(`/records/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRecord: (id) => request(`/records/${id}`, { method: 'DELETE' }),
  getDashboard: () => request('/records/stats/dashboard'),

  // Upload
  uploadBill: (file, expenseType = 'general') => {
    const fd = new FormData();
    fd.append('bill', file);
    fd.append('expense_type', expenseType);
    return fetch(`${BASE}/upload`, { method: 'POST', body: fd }).then(r => {
      if (!r.ok) return r.json().then(e => { throw new Error(e.error); });
      return r.json();
    });
  },

  // Export
  exportUrl: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return `${BASE}/export${qs ? `?${qs}` : ''}`;
  },

  // Settings
  getSettings: () => request('/settings'),
  updateSettings: (data) => request('/settings', { method: 'PUT', body: JSON.stringify(data) }),
  getExchangeRates: () => request('/settings/exchange-rates'),

  // Savings
  getSavingsSummary: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return request(`/savings/summary${qs ? `?${qs}` : ''}`);
  },
  getSavings: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return request(`/savings${qs ? `?${qs}` : ''}`);
  },
  createSaving: (data) => request('/savings', { method: 'POST', body: JSON.stringify(data) }),
  bulkSavings: (records) => request('/savings/bulk', { method: 'POST', body: JSON.stringify(records) }),
  deleteSaving: (id) => request(`/savings/${id}`, { method: 'DELETE' }),
};
