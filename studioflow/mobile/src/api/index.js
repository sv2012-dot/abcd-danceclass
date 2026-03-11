import api from './client';

export const auth = {
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
};
export const students = {
  list: (schoolId) => api.get(`/schools/${schoolId}/students`),
  create: (schoolId, data) => api.post(`/schools/${schoolId}/students`, data),
  update: (schoolId, id, data) => api.put(`/schools/${schoolId}/students/${id}`, data),
};
export const batches = {
  list: (schoolId) => api.get(`/schools/${schoolId}/batches`),
  get: (schoolId, id) => api.get(`/schools/${schoolId}/batches/${id}`),
};
export const schedules = {
  list: (schoolId) => api.get(`/schools/${schoolId}/schedules`),
};
export const recitals = {
  list: (schoolId) => api.get(`/schools/${schoolId}/recitals`),
  get: (schoolId, id) => api.get(`/schools/${schoolId}/recitals/${id}`),
  toggleTask: (schoolId, id, taskId) => api.put(`/schools/${schoolId}/recitals/${id}/tasks/${taskId}/toggle`),
  addTask: (schoolId, id, task_text) => api.post(`/schools/${schoolId}/recitals/${id}/tasks`, { task_text }),
};
export const fees = {
  list: (schoolId, params) => api.get(`/schools/${schoolId}/fees`, { params }),
  summary: (schoolId) => api.get(`/schools/${schoolId}/fees/summary`),
  updateStatus: (schoolId, feeId, data) => api.put(`/schools/${schoolId}/fees/${feeId}/status`, data),
};
export const parent = {
  students: () => api.get('/parent/students'),
  schedule: () => api.get('/parent/schedule'),
  recitals: () => api.get('/parent/recitals'),
};