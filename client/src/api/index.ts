import { http } from './client';
import type {
  AuthResponse,
  CalendarData,
  CalendarEvent,
  DashboardData,
  EventInput,
  Goal,
  GoalInput,
  Household,
  MeResponse,
  Page,
  PageInput,
  PageSummary,
  Period,
  Scope,
  Task,
  TaskInput,
  TaskStatus,
  User,
} from './types';

export * from './types';
export { ApiError, getToken, setToken, setUnauthorizedHandler } from './client';

export const authApi = {
  register: (body: {
    name: string;
    email: string;
    password: string;
    initial?: string;
    color?: string;
    inviteCode?: string;
  }) => http.post<AuthResponse>('/auth/register', body),
  login: (body: { email: string; password: string }) => http.post<AuthResponse>('/auth/login', body),
  me: () => http.get<MeResponse>('/auth/me'),
  updateMe: (body: { name?: string; initial?: string; color?: string; password?: string }) =>
    http.patch<{ user: User }>('/auth/me', body),
};

export const householdApi = {
  get: () => http.get<Household>('/household'),
  update: (body: { name: string }) => http.patch<Household>('/household', body),
  regenerateInvite: () => http.post<Household>('/household/invite-code'),
};

export const eventsApi = {
  list: (params: { from: string; to: string; scope: Scope }) => http.get<CalendarEvent[]>('/events', params),
  get: (id: number) => http.get<CalendarEvent>(`/events/${id}`),
  create: (body: EventInput) => http.post<CalendarEvent>('/events', body),
  update: (id: number, body: Partial<EventInput>) => http.patch<CalendarEvent>(`/events/${id}`, body),
  remove: (id: number) => http.del(`/events/${id}`),
};

export const tasksApi = {
  list: (params: { scope: Scope; status?: TaskStatus; dueFrom?: string; dueTo?: string }) =>
    http.get<Task[]>('/tasks', params),
  get: (id: number) => http.get<Task>(`/tasks/${id}`),
  create: (body: TaskInput) => http.post<Task>('/tasks', body),
  update: (id: number, body: Partial<TaskInput>) => http.patch<Task>(`/tasks/${id}`, body),
  remove: (id: number) => http.del(`/tasks/${id}`),
  move: (id: number, body: { status: TaskStatus; position?: number }) => http.post<Task>(`/tasks/${id}/move`, body),
};

export const goalsApi = {
  list: (params: { scope: Scope; period?: Period; from?: string; to?: string }) => http.get<Goal[]>('/goals', params),
  get: (id: number) => http.get<Goal>(`/goals/${id}`),
  create: (body: GoalInput) => http.post<Goal>('/goals', body),
  update: (id: number, body: Partial<GoalInput>) => http.patch<Goal>(`/goals/${id}`, body),
  remove: (id: number) => http.del(`/goals/${id}`),
};

export const pagesApi = {
  list: (params: { scope: Scope; parentId?: number | 'root'; period?: Period; from?: string; to?: string }) =>
    http.get<PageSummary[]>('/pages', params),
  get: (id: number) => http.get<Page>(`/pages/${id}`),
  create: (body: PageInput) => http.post<Page>('/pages', body),
  update: (id: number, body: PageInput) => http.patch<Page>(`/pages/${id}`, body),
  remove: (id: number) => http.del(`/pages/${id}`),
};

export const calendarApi = {
  get: (params: { from: string; to: string; scope: Scope }) => http.get<CalendarData>('/calendar', params),
};

export const dashboardApi = {
  get: (params: { date: string; scope: Scope }) => http.get<DashboardData>('/dashboard', params),
};
