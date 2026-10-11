export interface Task {
  id: number;
  title: string;
  project_name: string | null;
  due_date: string | null;
  est_minutes: number | null;
  status: 'todo' | 'doing' | 'done';
  done_criteria: string | null;
  notes: string | null;
  completed_on?: string | null;
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
  source: 'ai' | 'rule';
  aiLimited?: boolean;
}
export interface Cheer {
  text: string;
  source: 'ai' | 'rule';
  aiLimited?: boolean;
}
export interface Dashboard {
  date: string;
  user: { displayName: string; timezone: string };
  recommended: Recommended;
  events: EventItem[];
  weekDone: number;
  todayDone: number;
  openCount: number;
  cheer: Cheer;
  stale: { recommend: boolean; cheer: boolean };
  aiRemaining: number;
}
