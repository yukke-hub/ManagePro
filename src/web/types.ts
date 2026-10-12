export interface Task {
  id: number;
  title: string;
  project_name: string | null;
  due_date: string | null;
  est_minutes: number | null;
  urgency: number;
  priority: number;
  status: 'todo' | 'doing' | 'done';
  done_criteria: string | null;
  notes: string | null;
  completed_on?: string | null;
  score?: number;
}
export interface EventItem {
  id: number;
  task_id: number | null;
  title: string;
  start_at: string; // YYYY-MM-DDTHH:MM
  end_at: string;
  status: 'confirmed' | 'proposed';
  source: 'user' | 'ai';
}
export interface Recommended {
  tasks: Task[];
  reason: string | null;
  source: 'rule';
}
export interface Cheer {
  text: string;
  source: 'rule';
}
export interface Dashboard {
  date: string;
  user: { displayName: string; timezone: string; workStart: string; workEnd: string };
  recommended: Recommended;
  events: EventItem[];
  weekDone: number;
  todayDone: number;
  openCount: number;
  cheer: Cheer;
  aiRemaining: number;
}
