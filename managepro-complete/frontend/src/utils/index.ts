import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns'
import { ja } from 'date-fns/locale'
import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatDate(dateStr: string | null | undefined, fmt = 'M月d日'): string {
  if (!dateStr) return '—'
  try {
    const d = parseISO(dateStr)
    if (!isValid(d)) return '—'
    return format(d, fmt, { locale: ja })
  } catch {
    return '—'
  }
}

export function formatDateTime(dateStr: string | null | undefined): string {
  return formatDate(dateStr, 'M月d日 HH:mm')
}

export function formatRelative(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true, locale: ja })
  } catch {
    return '—'
  }
}

export function formatCurrency(amount: number, currency = 'JPY'): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount)
}

export const PRIORITY_LABELS: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
  urgent: '緊急',
}

export const PRIORITY_COLORS: Record<string, string> = {
  low: '#10B981',
  medium: '#F59E0B',
  high: '#F97316',
  urgent: '#EF4444',
}

export const STATUS_LABELS: Record<string, string> = {
  todo: '未着手',
  in_progress: '進行中',
  review: 'レビュー',
  done: '完了',
}

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  todo: { bg: '#F3F4F6', text: '#6B7280' },
  in_progress: { bg: '#FEF3C7', text: '#92400E' },
  review: { bg: '#DBEAFE', text: '#1E40AF' },
  done: { bg: '#D1FAE5', text: '#065F46' },
}

export const JOB_TYPE_LABELS: Record<string, string> = {
  student: '学生',
  designer: 'デザイナー',
  engineer: 'エンジニア',
  manager: 'マネージャー',
  marketing: 'マーケター',
  sales: '営業',
  other: 'その他',
}

export const BLOCK_TYPE_LABELS: Record<string, string> = {
  task_manager: 'タスク管理',
  chat_space: 'チャット',
  meeting_space: 'ミーティング',
  budget_tool: '予算管理',
  whiteboard: 'ホワイトボード',
  resource_embed: '資料',
}

export const BLOCK_TYPE_ICONS: Record<string, string> = {
  task_manager: '✅',
  chat_space: '💬',
  meeting_space: '📹',
  budget_tool: '💰',
  whiteboard: '🎨',
  resource_embed: '📎',
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function generateColor(str: string): string {
  const colors = ['#9664F7', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#F97316']
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export function debounce<T extends (...args: any[]) => any>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>
  return ((...args: any[]) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }) as T
}

export function detectResourceType(url: string): string {
  if (url.includes('docs.google.com')) return 'google_doc'
  if (url.includes('figma.com')) return 'figma'
  if (url.includes('notion.so')) return 'notion'
  if (url.endsWith('.pdf')) return 'pdf'
  return 'link'
}
