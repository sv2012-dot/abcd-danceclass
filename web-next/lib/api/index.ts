import api from './client';

export const recitals = {
  getPublic: (schoolSlug: string, recitalSlug: string) =>
    fetch(`https://abcd-danceclass-production.up.railway.app/api/public/${schoolSlug}/${recitalSlug}`)
      .then(r => r.json()),
};

// All other endpoints (authenticated, will be added as we migrate pages)
export const auth = {
  login: (data: any) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  changePassword: (data: any) => api.put('/auth/change-password', data),
};

export const schools = {
  list: () => api.get('/schools'),
  get: (id: string) => api.get(`/schools/${id}`),
  create: (data: any) => api.post('/schools', data),
  update: (id: string, data: any) => api.put(`/schools/${id}`, data),
};

export const recitalsAuth = {
  list: (schoolId: string) => api.get(`/schools/${schoolId}/recitals`),
  get: (schoolId: string, id: string) => api.get(`/schools/${schoolId}/recitals/${id}`),
  create: (schoolId: string, data: any) => api.post(`/schools/${schoolId}/recitals`, data),
  update: (schoolId: string, id: string, data: any) => api.put(`/schools/${schoolId}/recitals/${id}`, data),
  uploadPoster: (schoolId: string, id: string, poster_url: string) =>
    api.patch(`/schools/${schoolId}/recitals/${id}/poster`, { poster_url }),
};

export const upload = {
  image: (data: string) => api.post('/upload/image', { data }),
};
