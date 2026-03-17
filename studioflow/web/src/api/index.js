import api from './client';

export const auth = {
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  changePassword: (data) => api.put('/auth/change-password', data),
};

export const schools = {
  list: () => api.get('/schools'),
  get: (id) => api.get(`/schools/${id}`),
  create: (data) => api.post('/schools', data),
  update: (id, data) => api.put(`/schools/${id}`, data),
  stats: (id) => api.get(`/schools/${id}/stats`),
};

export const students = {
  list: (schoolId) => api.get(`/schools/${schoolId}/students`),
  get: (schoolId, id) => api.get(`/schools/${schoolId}/students/${id}`),
  create: (schoolId, data) => api.post(`/schools/${schoolId}/students`, data),
  update: (schoolId, id, data) => api.put(`/schools/${schoolId}/students/${id}`, data),
  remove: (schoolId, id) => api.delete(`/schools/${schoolId}/students/${id}`),
  setBatches: (schoolId, id, batch_ids) => api.put(`/schools/${schoolId}/students/${id}/batches`, { batch_ids }),
  toggleFee: (schoolId, studentId, due_day) => api.post(`/schools/${schoolId}/fees/toggle-current/${studentId}`, { due_day }),
};

export const batches = {
  list: (schoolId) => api.get(`/schools/${schoolId}/batches`),
  get: (schoolId, id) => api.get(`/schools/${schoolId}/batches/${id}`),
  create: (schoolId, data) => api.post(`/schools/${schoolId}/batches`, data),
  update: (schoolId, id, data) => api.put(`/schools/${schoolId}/batches/${id}`, data),
  remove: (schoolId, id) => api.delete(`/schools/${schoolId}/batches/${id}`),
  enroll: (schoolId, id, student_ids) => api.put(`/schools/${schoolId}/batches/${id}/enroll`, { student_ids }),
};

export const schedules = {
  list: (schoolId) => api.get(`/schools/${schoolId}/schedules`),
  create: (schoolId, data) => api.post(`/schools/${schoolId}/schedules`, data),
  update: (schoolId, id, data) => api.put(`/schools/${schoolId}/schedules/${id}`, data),
  remove: (schoolId, id) => api.delete(`/schools/${schoolId}/schedules/${id}`),
};

export const recitals = {
  list: (schoolId) => api.get(`/schools/${schoolId}/recitals`),
  get: (schoolId, id) => api.get(`/schools/${schoolId}/recitals/${id}`),
  create: (schoolId, data) => api.post(`/schools/${schoolId}/recitals`, data),
  update: (schoolId, id, data) => api.put(`/schools/${schoolId}/recitals/${id}`, data),
  remove: (schoolId, id) => api.delete(`/schools/${schoolId}/recitals/${id}`),
  addTask: (schoolId, id, task_text) => api.post(`/schools/${schoolId}/recitals/${id}/tasks`, { task_text }),
  toggleTask: (schoolId, id, taskId) => api.put(`/schools/${schoolId}/recitals/${id}/tasks/${taskId}/toggle`),
  deleteTask: (schoolId, id, taskId) => api.delete(`/schools/${schoolId}/recitals/${id}/tasks/${taskId}`),
};

export const fees = {
  plans: (schoolId) => api.get(`/schools/${schoolId}/fees/plans`),
  createPlan: (schoolId, data) => api.post(`/schools/${schoolId}/fees/plans`, data),
  list: (schoolId, params) => api.get(`/schools/${schoolId}/fees`, { params }),
  create: (schoolId, data) => api.post(`/schools/${schoolId}/fees`, data),
  updateStatus: (schoolId, feeId, data) => api.put(`/schools/${schoolId}/fees/${feeId}/status`, data),
  summary: (schoolId) => api.get(`/schools/${schoolId}/fees/summary`),
};

export const users = {
  list: (schoolId) => api.get(`/schools/${schoolId}/users`),
  create: (schoolId, data) => api.post(`/schools/${schoolId}/users`, data),
  update: (schoolId, id, data) => api.put(`/schools/${schoolId}/users/${id}`, data),
};

export const events = {
  list: (schoolId, params) => api.get(`/schools/${schoolId}/events`, { params }),
  create: (schoolId, data) => api.post(`/schools/${schoolId}/events`, data),
  update: (schoolId, id, data) => api.put(`/schools/${schoolId}/events/${id}`, data),
  remove: (schoolId, id) => api.delete(`/schools/${schoolId}/events/${id}`),
  studioNeeded: (schoolId) => api.get(`/schools/${schoolId}/events/studio-needed`),
};

export const todos = {
  list: (schoolId) => api.get(`/schools/${schoolId}/todos`),
  create: (schoolId, data) => api.post(`/schools/${schoolId}/todos`, data),
  toggle: (schoolId, id) => api.put(`/schools/${schoolId}/todos/${id}/toggle`),
  update: (schoolId, id, data) => api.put(`/schools/${schoolId}/todos/${id}`, data),
  remove: (schoolId, id) => api.delete(`/schools/${schoolId}/todos/${id}`),
};

export const parent = {
  students: () => api.get('/parent/students'),
  schedule: () => api.get('/parent/schedule'),
  recitals: () => api.get('/parent/recitals'),
};

export const studios = {
  list:   (schoolId)        => api.get(`/schools/${schoolId}/studios`),
  create: (schoolId, data)  => api.post(`/schools/${schoolId}/studios`, data),
  update: (schoolId, id, d) => api.put(`/schools/${schoolId}/studios/${id}`, d),
  remove: (schoolId, id)    => api.delete(`/schools/${schoolId}/studios/${id}`),
};