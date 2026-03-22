// ─── Auth ─────────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  username: string
  job_type: string
  avatar_url: string | null
  subscription_status: 'trial' | 'active' | 'cancelled' | 'expired'
  trial_ends_at?: string
  subscription_expires_at?: string
  status_emoji?: string
  status_text?: string
  note_text?: string
}

export interface UserStatus {
  status_emoji: string
  status_text: string
  note_text: string
}

// ─── Organization ──────────────────────────────────────────────────────────

export interface Organization {
  id: string
  name: string
  description: string
  logo_url: string | null
  owner_id: string
  role?: 'owner' | 'admin' | 'member'
  member_count?: number
  created_at: string
}

export interface OrgMember {
  id: string
  username: string
  email: string
  avatar_url: string | null
  job_type: string
  role: 'owner' | 'admin' | 'member'
  joined_at: string
  status_emoji?: string
  status_text?: string
}

// ─── Project ───────────────────────────────────────────────────────────────

export interface Project {
  id: string
  org_id: string
  name: string
  description: string
  color: string
  status: 'active' | 'completed' | 'archived'
  created_by: string
  role?: string
  member_count?: number
  open_tasks?: number
  next_meeting?: string | null
  nearest_task?: string | null
  members?: ProjectMember[]
  blocks?: ProjectBlock[]
  created_at: string
  updated_at: string
}

export interface ProjectMember {
  id: string
  username: string
  avatar_url: string | null
  job_type: string
  role: string
  status_emoji?: string
  status_text?: string
}

export type BlockType = 'task_manager' | 'chat_space' | 'meeting_space' | 'budget_tool' | 'whiteboard' | 'resource_embed'

export interface ProjectBlock {
  id: string
  project_id: string
  block_type: BlockType
  title: string
  position: number
  config: string // JSON string
  is_visible: number
  created_at: string
}

// ─── Task ─────────────────────────────────────────────────────────────────

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Task {
  id: string
  project_id: string
  block_id: string | null
  parent_task_id: string | null
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
  assignee_id: string | null
  assignee_name?: string
  assignee_avatar?: string | null
  position: number
  protocol: string
  subtask_count?: number
  link_count?: number
  subtasks?: Task[]
  links?: TaskLink[]
  project_name?: string
  project_color?: string
  created_at: string
  updated_at: string
}

export interface TaskLink {
  id: string
  task_id: string
  title: string
  url: string
}

// ─── Calendar ──────────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: string
  user_id?: string
  project_id?: string
  source_type: 'custom' | 'task' | 'meeting'
  source_id?: string
  title: string
  description: string
  start_at: string
  end_at?: string | null
  all_day: number
  color: string
}

// ─── Meeting ───────────────────────────────────────────────────────────────

export interface Meeting {
  id: string
  project_id: string
  block_id?: string | null
  title: string
  description: string
  scheduled_at: string
  duration_minutes: number
  jitsi_room_id: string
  status: 'scheduled' | 'active' | 'completed' | 'cancelled'
  created_by: string
  created_by_name?: string
  attendee_count?: number
}

export interface MeetingMinutes {
  id: string
  meeting_id: string
  title: string
  content: string
  created_by: string
  created_by_name: string
  created_at: string
  updated_at: string
}

// ─── Chat ─────────────────────────────────────────────────────────────────

export interface ChatThread {
  id: string
  project_id: string
  block_id?: string | null
  name: string
  description: string
  permission: 'all' | 'restricted'
  created_by: string
  created_by_name?: string
  message_count?: number
  last_message?: string | null
  created_at: string
}

export interface ChatMessage {
  id: string
  thread_id: string
  user_id: string
  username: string
  avatar_url?: string | null
  content: string
  is_edited: number
  created_at: string
}

// ─── Budget ───────────────────────────────────────────────────────────────

export interface Budget {
  id: string
  project_id: string
  block_id?: string | null
  total_amount: number
  currency: string
  items: BudgetItem[]
}

export interface BudgetItem {
  id: string
  budget_id: string
  category: string
  name: string
  description: string
  planned_amount: number
  actual_amount: number
  date?: string | null
  status: 'planned' | 'paid' | 'pending'
}

// ─── Resource ─────────────────────────────────────────────────────────────

export interface Resource {
  id: string
  project_id: string
  block_id?: string | null
  title: string
  url: string
  resource_type: 'link' | 'google_doc' | 'figma' | 'notion' | 'pdf' | 'other'
  created_by: string
  created_by_name?: string
  created_at: string
}

// ─── API ──────────────────────────────────────────────────────────────────

export interface ApiError {
  error: string
}
