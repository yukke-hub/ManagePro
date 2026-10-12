import { ref } from 'vue';
import { api, ApiError, SessionError } from './api';
import type { Dashboard, EventItem, Task } from './types';

export const dash = ref<Dashboard | null>(null);
export const sessionExpired = ref(false);

/**
 * 画面は左右 2 ペインに分かれている。
 * - leftView: 左側に常に表示される一覧(タスク一覧 / 予定一覧 / ホーム)
 * - scheduleMode: leftView が 'schedule' のときの表示形式
 * - panel: 右側に開く操作カード(追加・編集・設定)。null なら右ペインは表示しない
 */
export const leftView = ref<'home' | 'tasks' | 'schedule'>('home');
export const scheduleMode = ref<'week' | 'upcoming' | 'calendar' | 'free'>('week');
export const panel = ref<string | null>(null);
export const editing = ref<Task | null>(null);
export const editingEvent = ref<EventItem | null>(null);
export const listTab = ref<'open' | 'done'>('open'); // タスク一覧のタブ(編集から戻っても保持)

/** サイドバーのメニュー操作。左ペインの表示先と、右ペインに開く操作カードをまとめて決める */
export function setLeft(key: string) {
  editing.value = null;
  editingEvent.value = null;
  switch (key) {
    case 'task-new':
      leftView.value = 'tasks';
      panel.value = panel.value === 'task-new' ? null : 'task-new';
      break;
    case 'task-list':
      leftView.value = 'tasks';
      panel.value = null;
      break;
    case 'event-new':
      leftView.value = 'schedule';
      panel.value = panel.value === 'event-new' ? null : 'event-new';
      break;
    case 'week':
    case 'upcoming':
    case 'calendar':
    case 'free':
      leftView.value = 'schedule';
      scheduleMode.value = key;
      panel.value = null;
      break;
    case 'settings':
      panel.value = panel.value === 'settings' ? null : 'settings';
      break;
    default:
      leftView.value = 'home';
      panel.value = null;
  }
}

export function openEdit(t: Task) {
  editing.value = t;
  panel.value = 'task-edit';
}
export function openEventEdit(e: EventItem) {
  editingEvent.value = e;
  panel.value = 'event-edit';
}
export function closeEdit() {
  editing.value = null;
  editingEvent.value = null;
  panel.value = null;
}
export const toasts = ref<{ id: number; text: string; undo?: () => Promise<unknown> }[]>([]);

export function toast(text: string) {
  const id = Date.now() + Math.random();
  toasts.value.push({ id, text });
  setTimeout(() => (toasts.value = toasts.value.filter((t) => t.id !== id)), 3200);
}

/** API 呼び出しを包む。失敗はトーストで伝え、期限切れは再読み込みの案内を出す */
export async function run<T>(fn: () => Promise<T>, failText = 'うまくいきませんでした。もう一度お試しください。'): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof SessionError) sessionExpired.value = true;
    else toast(e instanceof ApiError && e.status === 400 ? '入力内容を確認してください。' : failText);
    return undefined;
  }
}

export async function loadDashboard() {
  const d = await run(() => api.get<Dashboard>('/dashboard'));
  if (d) dash.value = d;
}

export async function completeTask(id: number, title?: string): Promise<boolean> {
  const ok = await run(() => api.patch(`/tasks/${id}`, { status: 'done' }));
  if (ok) {
    await loadDashboard();
    if (title) toastUndo(`「${title}」を完了にしました。`, () => reopenTask(id));
  }
  return !!ok;
}

/** 「元に戻す」ボタン付きのトースト */
export function toastUndo(text: string, onUndo: () => Promise<unknown>) {
  const id = Date.now() + Math.random();
  toasts.value.push({ id, text, undo: onUndo });
  setTimeout(() => (toasts.value = toasts.value.filter((t) => t.id !== id)), 5000);
}

export async function reopenTask(id: number): Promise<boolean> {
  const ok = await run(() => api.patch(`/tasks/${id}`, { status: 'todo' }));
  if (ok) await loadDashboard();
  return !!ok;
}

// 実行推奨タスク・励ましコメントはダッシュボード取得時にロジックのみで計算されるため、
// 画面側で AI を追加で呼び直す処理(旧 refreshAiOnce)は不要になった。
