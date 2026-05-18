import api from './client';

export const auth = {
  login: (data: any) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  changePassword: (data: any) => api.put('/auth/change-password', data),
  // Magic-link auth — primary path
  requestMagicLink: (email: string) => api.post('/auth/magic-link', { email }),
  consumeMagicLink: (token: string) => api.post('/auth/magic-link/consume', { token }),
  // Multi-school chooser
  chooseSchool: (chooser_token: string, school_id: number) =>
    api.post('/auth/choose-school', { chooser_token, school_id }),
  switchSchool: () => api.post('/auth/switch-school', {}),
};

export const schools = {
  list: () => api.get('/schools'),
  get: (id: string) => api.get(`/schools/${id}`),
  create: (data: any) => api.post('/schools', data),
  update: (id: string, data: any) => api.put(`/schools/${id}`, data),
  softDelete: (id: string, password: string) => api.delete(`/schools/${id}`, { data: { password } }),
  restore: (id: string) => api.post(`/schools/${id}/restore`),
  stats: (id: string) => api.get(`/schools/${id}/stats`),
  resetAdminPassword: (id: string, password: string) => api.post(`/schools/${id}/reset-admin-password`, { password }),
  resetStripe: (id: string) => api.post(`/schools/${id}/reset-stripe`),
  seedSample: (id: string) => api.post(`/schools/${id}/seed-sample`),
};

export const students = {
  list: (schoolId: string) => api.get(`/schools/${schoolId}/students`),
  get: (schoolId: string, id: string) => api.get(`/schools/${schoolId}/students/${id}`),
  create: (schoolId: string, data: any) => api.post(`/schools/${schoolId}/students`, data),
  update: (schoolId: string, id: string, data: any) => api.put(`/schools/${schoolId}/students/${id}`, data),
  remove: (schoolId: string, id: string) => api.delete(`/schools/${schoolId}/students/${id}`),
  setBatches: (schoolId: string, id: string, batch_ids: any) => api.put(`/schools/${schoolId}/students/${id}/batches`, { batch_ids }),
  toggleFee: (schoolId: string, studentId: string, due_day: any) => api.post(`/schools/${schoolId}/fees/toggle-current/${studentId}`, { due_day }),
};

export const batches = {
  list: (schoolId: string, includeDeleted = false) =>
    api.get(`/schools/${schoolId}/batches${includeDeleted ? '?include_deleted=true' : ''}`),
  get: (schoolId: string, id: string) => api.get(`/schools/${schoolId}/batches/${id}`),
  create: (schoolId: string, data: any) => api.post(`/schools/${schoolId}/batches`, data),
  update: (schoolId: string, id: string, data: any) => api.put(`/schools/${schoolId}/batches/${id}`, data),
  // Soft-delete: stays in DB for 30 days, then purgeDeletedBatches cron
  // hard-deletes it + all dependents.
  remove: (schoolId: string, id: string) => api.delete(`/schools/${schoolId}/batches/${id}`),
  // Returns counts of what will be hidden, so the confirm dialog can
  // show "you'll lose X events, Y attendance records, etc."
  deletePreview: (schoolId: string, id: string | number) =>
    api.get(`/schools/${schoolId}/batches/${id}/delete-preview`),
  // Restore a soft-deleted batch within the 30-day window.
  restore: (schoolId: string, id: string | number) =>
    api.post(`/schools/${schoolId}/batches/${id}/restore`),
  enroll: (schoolId: string, id: string, student_ids: any) => api.put(`/schools/${schoolId}/batches/${id}/enroll`, { student_ids }),
  uploadCover: (schoolId: string, id: string, cover_url: string) => api.patch(`/schools/${schoolId}/batches/${id}/cover`, { cover_url }),
};

export const schedules = {
  list: (schoolId: string) => api.get(`/schools/${schoolId}/schedules`),
  create: (schoolId: string, data: any) => api.post(`/schools/${schoolId}/schedules`, data),
  update: (schoolId: string, id: string, data: any) => api.put(`/schools/${schoolId}/schedules/${id}`, data),
  remove: (schoolId: string, id: string) => api.delete(`/schools/${schoolId}/schedules/${id}`),
};

export const scheduleExceptions = {
  list: (schoolId: string) => api.get(`/schools/${schoolId}/schedules/exceptions`),
  create: (schoolId: string, data: any) => api.post(`/schools/${schoolId}/schedules/exceptions`, data),
  remove: (schoolId: string, id: string) => api.delete(`/schools/${schoolId}/schedules/exceptions/${id}`),
};

// Public (unauthenticated) recital endpoint — used by [schoolSlug]/[recitalSlug]
const PUBLIC_API_BASE =
  (process.env.NEXT_PUBLIC_API_URL?.trim()) ||
  'https://abcd-danceclass-production.up.railway.app/api';

export const recitals = {
  getPublic: (schoolSlug: string, recitalSlug: string) =>
    // cache: 'no-store' so SSR-rendered public recital pages always
    // reflect the latest poster + venue + RSVP state. Without this,
    // Next.js + Vercel cached the fetch indefinitely → a teacher
    // updating the poster saw the new image in /recitals but the
    // public link still served the old one. Pair with
    // `export const dynamic = 'force-dynamic'` on the page.
    fetch(`${PUBLIC_API_BASE}/public/${schoolSlug}/${recitalSlug}`, { cache: 'no-store' })
      .then(r => r.json()),
  submitPublicRsvp: (
    schoolSlug: string,
    recitalSlug: string,
    body: { name: string; email?: string; response: 'Confirmed' | 'Declined'; plus_ones: number }
  ) =>
    fetch(`${PUBLIC_API_BASE}/public/${schoolSlug}/${recitalSlug}/rsvp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(async r => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
      return data;
    }),
  list: (schoolId: string) => api.get(`/schools/${schoolId}/recitals`),
  get: (schoolId: string, id: string) => api.get(`/schools/${schoolId}/recitals/${id}`),
  create: (schoolId: string, data: any) => api.post(`/schools/${schoolId}/recitals`, data),
  update: (schoolId: string, id: string, data: any) => api.put(`/schools/${schoolId}/recitals/${id}`, data),
  remove: (schoolId: string, id: string) => api.delete(`/schools/${schoolId}/recitals/${id}`),
  uploadPoster: (schoolId: string, id: string, poster_url: string) => api.patch(`/schools/${schoolId}/recitals/${id}/poster`, { poster_url }),
  addTask: (schoolId: string, id: string, task_text: string) => api.post(`/schools/${schoolId}/recitals/${id}/tasks`, { task_text }),
  toggleTask: (schoolId: string, id: string, taskId: string) => api.put(`/schools/${schoolId}/recitals/${id}/tasks/${taskId}/toggle`),
  deleteTask: (schoolId: string, id: string, taskId: string) => api.delete(`/schools/${schoolId}/recitals/${id}/tasks/${taskId}`),
  listParticipants: (schoolId: string, id: string) => api.get(`/schools/${schoolId}/recitals/${id}/participants`),
  addParticipant: (schoolId: string, id: string, data: any) => api.post(`/schools/${schoolId}/recitals/${id}/participants`, data),
  updateParticipant: (schoolId: string, id: string, participantId: string, data: any) => api.put(`/schools/${schoolId}/recitals/${id}/participants/${participantId}`, data),
  updateParticipantRsvp: (schoolId: string, id: string, participantId: string, rsvp_status: any) => api.put(`/schools/${schoolId}/recitals/${id}/participants/${participantId}`, { rsvp_status }),
  deleteParticipant: (schoolId: string, id: string, participantId: string) => api.delete(`/schools/${schoolId}/recitals/${id}/participants/${participantId}`),
};

// Backwards-compatible alias for any older imports
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

export const fees = {
  plans: (schoolId: string) => api.get(`/schools/${schoolId}/fees/plans`),
  createPlan: (schoolId: string, data: any) => api.post(`/schools/${schoolId}/fees/plans`, data),
  list: (schoolId: string, params?: any) => api.get(`/schools/${schoolId}/fees`, { params }),
  create: (schoolId: string, data: any) => api.post(`/schools/${schoolId}/fees`, data),
  updateStatus: (schoolId: string, feeId: string, data: any) => api.put(`/schools/${schoolId}/fees/${feeId}/status`, data),
  summary: (schoolId: string) => api.get(`/schools/${schoolId}/fees/summary`),
};

export const users = {
  list: (schoolId: string) => api.get(`/schools/${schoolId}/users`),
  create: (schoolId: string, data: any) => api.post(`/schools/${schoolId}/users`, data),
  update: (schoolId: string, id: string, data: any) => api.put(`/schools/${schoolId}/users/${id}`, data),
};

export const events = {
  list: (schoolId: string, params?: any) => api.get(`/schools/${schoolId}/events`, { params }),
  create: (schoolId: string, data: any) => api.post(`/schools/${schoolId}/events`, data),
  update: (schoolId: string, id: string, data: any) => api.put(`/schools/${schoolId}/events/${id}`, data),
  remove: (schoolId: string, id: string) => api.delete(`/schools/${schoolId}/events/${id}`),
  studioNeeded: (schoolId: string) => api.get(`/schools/${schoolId}/events/studio-needed`),
  uploadCover: (schoolId: string, id: string | number, cover_url: string) =>
    api.put(`/schools/${schoolId}/events/${id}/cover`, { cover_url }),
};

export const todos = {
  list: (schoolId: string) => api.get(`/schools/${schoolId}/todos`),
  create: (schoolId: string, data: any) => api.post(`/schools/${schoolId}/todos`, data),
  toggle: (schoolId: string, id: string) => api.put(`/schools/${schoolId}/todos/${id}/toggle`),
  update: (schoolId: string, id: string, data: any) => api.put(`/schools/${schoolId}/todos/${id}`, data),
  remove: (schoolId: string, id: string) => api.delete(`/schools/${schoolId}/todos/${id}`),
};

export const parent = {
  students: () => api.get('/parent/students'),
  schedule: () => api.get('/parent/schedule'),
  recitals: () => api.get('/parent/recitals'),
};

export const studios = {
  list: (schoolId: string) => api.get(`/schools/${schoolId}/studios`),
  create: (schoolId: string, data: any) => api.post(`/schools/${schoolId}/studios`, data),
  update: (schoolId: string, id: string, d: any) => api.put(`/schools/${schoolId}/studios/${id}`, d),
  remove: (schoolId: string, id: string) => api.delete(`/schools/${schoolId}/studios/${id}`),
};

export const vendors = {
  list: (schoolId: string, category?: string) => api.get(`/schools/${schoolId}/vendors${category ? `?category=${encodeURIComponent(category)}` : ''}`),
  create: (schoolId: string, data: any) => api.post(`/schools/${schoolId}/vendors`, data),
  update: (schoolId: string, id: string, data: any) => api.put(`/schools/${schoolId}/vendors/${id}`, data),
  remove: (schoolId: string, id: string) => api.delete(`/schools/${schoolId}/vendors/${id}`),
};

// ── Attendance ──────────────────────────────────────────────────────────────
export type AttendanceStatus = 'present' | 'absent' | 'excused' | 'late';

// ── Smart ManchQ usage ──────────────────────────────────────────────────────
export const smart = {
  usageToday: () => api.get('/smart/usage/today'),
};

// ── Team / invitations ──────────────────────────────────────────────────────
export const team = {
  list:           () => api.get('/team'),
  invite:         (data: { email: string; role: 'school_admin' | 'teacher' }) =>
                    api.post('/team/invitations', data),
  resendInvite:   (id: number) => api.post(`/team/invitations/${id}/resend`),
  revokeInvite:   (id: number) => api.delete(`/team/invitations/${id}`),
  updateRole:     (id: number, role: 'school_admin' | 'teacher') =>
                    api.patch(`/team/members/${id}`, { role }),
  removeMember:   (id: number) => api.delete(`/team/members/${id}`),
  transferOwner:  (to_user_id: number, confirm_email: string) =>
                    api.post('/team/transfer-ownership', { to_user_id, confirm_email }),
  previewInvite:  (token: string) => api.get(`/team/invitations/${token}/preview`),
};

export const attendance = {
  // Event-based
  getForEvent: (schoolId: string, eventId: number, date: string) =>
    api.get(`/schools/${schoolId}/attendance/events/${eventId}`, { params: { date } }),
  saveForEvent: (schoolId: string, eventId: number, body: { class_date: string; entries: Array<{ student_id: number; status: AttendanceStatus; notes?: string }> }) =>
    api.post(`/schools/${schoolId}/attendance/events/${eventId}/bulk`, body),

  // Recurring schedule (class) based
  getForSchedule: (schoolId: string, scheduleId: number, date: string) =>
    api.get(`/schools/${schoolId}/attendance/schedule/${scheduleId}`, { params: { date } }),
  saveForSchedule: (schoolId: string, scheduleId: number, body: { class_date: string; entries: Array<{ student_id: number; status: AttendanceStatus; notes?: string }> }) =>
    api.post(`/schools/${schoolId}/attendance/schedule/${scheduleId}/bulk`, body),

  // Read-only summaries
  forStudent: (schoolId: string, studentId: number, params?: { from?: string; to?: string }) =>
    api.get(`/schools/${schoolId}/attendance/students/${studentId}`, { params }),
  batchStats: (schoolId: string, batchId: number, params?: { from?: string; to?: string }) =>
    api.get(`/schools/${schoolId}/attendance/batches/${batchId}/stats`, { params }),
};
