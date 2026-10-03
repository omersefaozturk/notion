export type Scope = 'mine' | 'partner' | 'merged';
export type Visibility = 'shared' | 'private';
export type TaskStatus = 'todo' | 'doing' | 'done';
export type Priority = 'low' | 'medium' | 'high';
export type Period = 'daily' | 'weekly' | 'monthly';

export interface OwnerSummary {
  id: number;
  name: string;
  initial: string;
  color: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  initial: string;
  color: string;
  householdId: number;
}

export interface Household {
  id: number;
  name: string;
  inviteCode: string;
  members: OwnerSummary[];
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface MeResponse {
  user: User;
  household: Household;
}

export interface CalendarEvent {
  id: number;
  title: string;
  description: string | null;
  start: string;
  end: string;
  allDay: boolean;
  location: string | null;
  color: string | null;
  visibility: Visibility;
  owner: OwnerSummary;
  createdAt: string;
  updatedAt: string;
}

export interface EventInput {
  title: string;
  description?: string;
  start: string;
  end?: string;
  allDay?: boolean;
  location?: string;
  color?: string | null;
  visibility?: Visibility;
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null;
  position: number;
  visibility: Visibility;
  owner: OwnerSummary;
  assignee: OwnerSummary | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  dueDate?: string | null;
  assigneeId?: number | null;
  visibility?: Visibility;
}

export interface Goal {
  id: number;
  title: string;
  description: string | null;
  period: Period;
  periodStart: string;
  periodEnd: string;
  progress: number;
  done: boolean;
  visibility: Visibility;
  owner: OwnerSummary;
  createdAt: string;
  updatedAt: string;
}

export interface GoalInput {
  title: string;
  description?: string;
  period: Period;
  periodStart: string;
  progress?: number;
  done?: boolean;
  visibility?: Visibility;
}

export type BlockType =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'todo'
  | 'bullet'
  | 'numbered'
  | 'quote'
  | 'divider'
  | 'callout'
  | 'code'
  | 'toggle';

export interface Block {
  id: string;
  type: BlockType;
  text: string;
  checked?: boolean;
  /** Nested blocks: a toggle's content, or indented list items (Tab). */
  children?: Block[];
  /** Toggle only: whether it is closed. Missing = closed. */
  collapsed?: boolean;
}

export interface PageSummary {
  id: number;
  title: string;
  icon: string | null;
  parentId: number | null;
  period: Period | null;
  periodStart: string | null;
  visibility: Visibility;
  owner: OwnerSummary;
  position: number;
  hasChildren: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Breadcrumb {
  id: number;
  title: string;
  icon: string | null;
}

export interface Page extends PageSummary {
  content: Block[];
  breadcrumbs: Breadcrumb[];
}

export interface PageInput {
  title?: string;
  icon?: string | null;
  parentId?: number | null;
  content?: Block[];
  period?: Period | null;
  periodStart?: string | null;
  visibility?: Visibility;
}

export interface CalendarData {
  events: CalendarEvent[];
  tasks: Task[];
  goals: Goal[];
  plans: PageSummary[];
}

export interface DashboardData {
  date: string;
  today: { events: CalendarEvent[]; tasks: Task[]; goals: Goal[]; plans: PageSummary[] };
  week: { events: CalendarEvent[]; goals: Goal[]; plans: PageSummary[]; tasks: Task[] };
  month: { goals: Goal[]; plans: PageSummary[] };
  taskCounts: { todo: number; doing: number; done: number };
}
