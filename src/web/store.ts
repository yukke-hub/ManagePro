import { ref } from 'vue';
import { api, ApiError, SessionError } from './api';
import type { Cheer, Dashboard, EventItem, Recommended, Task } from './types';

export const dash = ref<Dashboard | null>(null);
export const sessionExpired = ref(false);

/** 右パネルの状態。編集は「どのパネルから開いたか」を覚えておき、保存/キャンセルで戻る */
export const panel = ref<string | null>(null);
export const editing = ref<Task | null>(null);
export const editingEvent = ref<EventItem | null>(null);
let editReturn: string | null = null;
export const listTab = ref<'open' | 'done'>('open'); // タスク一覧のタブ(編集から戻っても保持)
export function openEdit(t: Task, returnTo: string | null) {
  editing.value = t;
  editReturn = returnTo;
  panel.value = 'task-edit';
}
export function openEventEdit(e: EventItem, returnTo: string | null) {
  editingEvent.value = e;
  editReturn = returnTo;
  panel.value = 'event-edit';
}
export function closeEdit() {
  editing.value = null;
  editingEvent.value = null;
  panel.value = editReturn;
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

let aiRefreshed = false;
/** 画面を開いたときに 1 回だけ、古くなった AI 結果を更新する(無料枠を守るため) */
export async function refreshAiOnce() {
  if (aiRefreshed || !dash.value) return;
  aiRefreshed = true;
  const { stale } = dash.value;
  if (stale.recommend) {
    const r = await run(() => api.post<{ recommended: Recommended }>('/ai/recommend'));
    if (r && dash.value) dash.value.recommended = r.recommended;
  }
  if (stale.cheer) {
    const r = await run(() => api.post<{ cheer: Cheer }>('/ai/cheer'));
    if (r && dash.value) dash.value.cheer = r.cheer;
  }
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
