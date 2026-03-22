import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('mp_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('mp_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

// ─── Auth ─────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data: { email: string; password: string; username: string; job_type?: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
}

// ─── Users ────────────────────────────────────────────────────────────────
export const usersApi = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data: any) => api.put('/users/profile', data),
  updateStatus: (data: any) => api.put('/users/status', data),
  getOrganizations: () => api.get('/users/organizations'),
  getCalendar: (start: string, end: string) => api.get(`/users/calendar?start=${start}&end=${end}`),
  addCalendarEvent: (data: any) => api.post('/users/calendar', data),
  deleteCalendarEvent: (id: string) => api.delete(`/users/calendar/${id}`),
  getTasks: () => api.get('/users/tasks'),
}

// ─── Organizations ────────────────────────────────────────────────────────
export const orgsApi = {
  list: () => api.get('/organizations'),
  create: (data: any) => api.post('/organizations', data),
  get: (id: string) => api.get(`/organizations/${id}`),
  update: (id: string, data: any) => api.put(`/organizations/${id}`, data),
  getMembers: (id: string) => api.get(`/organizations/${id}/members`),
  invite: (id: string, data: any) => api.post(`/organizations/${id}/invite`, data),
  removeMember: (orgId: string, userId: string) => api.delete(`/organizations/${orgId}/members/${userId}`),
}

// ─── Projects ─────────────────────────────────────────────────────────────
export const projectsApi = {
  list: (orgId?: string) => api.get(`/projects${orgId ? `?org_id=${orgId}` : ''}`),
  create: (data: any) => api.post('/projects', data),
  get: (id: string) => api.get(`/projects/${id}`),
  update: (id: string, data: any) => api.put(`/projects/${id}`, data),
  getMembers: (id: string) => api.get(`/projects/${id}/members`),
  addMember: (id: string, data: any) => api.post(`/projects/${id}/members`, data),
  createBlock: (id: string, data: any) => api.post(`/projects/${id}/blocks`, data),
  updateBlock: (id: string, blockId: string, data: any) => api.put(`/projects/${id}/blocks/${blockId}`, data),
  deleteBlock: (id: string, blockId: string) => api.delete(`/projects/${id}/blocks/${blockId}`),
}

// ─── Tasks ────────────────────────────────────────────────────────────────
export const tasksApi = {
  list: (projectId: string, blockId?: string) =>
    api.get(`/tasks?project_id=${projectId}${blockId ? `&block_id=${blockId}` : ''}`),
  get: (id: string) => api.get(`/tasks/${id}`),
  create: (data: any) => api.post('/tasks', data),
  update: (id: string, data: any) => api.put(`/tasks/${id}`, data),
  delete: (id: string) => api.delete(`/tasks/${id}`),
  updateStatus: (id: string, data: any) => api.patch(`/tasks/${id}/status`, data),
  addLink: (id: string, data: any) => api.post(`/tasks/${id}/links`, data),
  deleteLink: (id: string, linkId: string) => api.delete(`/tasks/${id}/links/${linkId}`),
}

// ─── Meetings ────────────────────────────────────────────────────────────
export const meetingsApi = {
  list: (projectId: string) => api.get(`/meetings?project_id=${projectId}`),
  create: (data: any) => api.post('/meetings', data),
  update: (id: string, data: any) => api.put(`/meetings/${id}`, data),
  delete: (id: string) => api.delete(`/meetings/${id}`),
  getMinutes: (id: string) => api.get(`/meetings/${id}/minutes`),
  createMinutes: (id: string, data: any) => api.post(`/meetings/${id}/minutes`, data),
  updateMinutes: (id: string, minuteId: string, data: any) => api.put(`/meetings/${id}/minutes/${minuteId}`, data),
}

// ─── Chat ─────────────────────────────────────────────────────────────────
export const chatApi = {
  getThreads: (projectId: string) => api.get(`/chat/threads?project_id=${projectId}`),
  createThread: (data: any) => api.post('/chat/threads', data),
  updateThread: (id: string, data: any) => api.put(`/chat/threads/${id}`, data),
  getMessages: (threadId: string, since?: string) =>
    api.get(`/chat/threads/${threadId}/messages${since ? `?since=${since}` : ''}`),
  sendMessage: (threadId: string, data: any) => api.post(`/chat/threads/${threadId}/messages`, data),
  deleteMessage: (msgId: string) => api.delete(`/chat/messages/${msgId}`),
}

// ─── Budget ───────────────────────────────────────────────────────────────
export const budgetApi = {
  get: (projectId: string, blockId?: string) =>
    api.get(`/budget?project_id=${projectId}${blockId ? `&block_id=${blockId}` : ''}`),
  update: (id: string, data: any) => api.put(`/budget/${id}`, data),
  addItem: (budgetId: string, data: any) => api.post(`/budget/${budgetId}/items`, data),
  updateItem: (itemId: string, data: any) => api.put(`/budget/items/${itemId}`, data),
  deleteItem: (itemId: string) => api.delete(`/budget/items/${itemId}`),
}

// ─── Whiteboard ───────────────────────────────────────────────────────────
export const whiteboardApi = {
  get: (projectId: string, blockId?: string) =>
    api.get(`/whiteboard?project_id=${projectId}${blockId ? `&block_id=${blockId}` : ''}`),
  update: (id: string, data: any) => api.put(`/whiteboard/${id}`, data),
}

// ─── Resources ────────────────────────────────────────────────────────────
export const resourcesApi = {
  list: (projectId: string, blockId?: string) =>
    api.get(`/resources?project_id=${projectId}${blockId ? `&block_id=${blockId}` : ''}`),
  add: (data: any) => api.post('/resources', data),
  delete: (id: string) => api.delete(`/resources/${id}`),
}

// ─── PayPal ───────────────────────────────────────────────────────────────
export const paypalApi = {
  getConfig: () => api.get('/paypal/config'),
  recordSubscription: (subscriptionId: string) =>
    api.post('/paypal/subscribe', { subscription_id: subscriptionId }),
}
