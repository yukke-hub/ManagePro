<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import AiBar from './components/AiBar.vue';
import EventForm from './components/EventForm.vue';
import FreeSlots from './components/FreeSlots.vue';
import Home from './components/Home.vue';
import ScheduleView from './components/ScheduleView.vue';
import Settings from './components/Settings.vue';
import Sidebar from './components/Sidebar.vue';
import TaskForm from './components/TaskForm.vue';
import TaskList from './components/TaskList.vue';
import EventEditForm from './components/EventEditForm.vue';
import TaskEditForm from './components/TaskEditForm.vue';
import { closeEdit, dash, editing, loadDashboard, panel, refreshAiOnce, sessionExpired, toasts } from './store';

const titles: Record<string, string> = {
  'task-new': 'タスクを追加する',
  'task-list': 'タスク',
  'task-edit': 'タスクを編集する',
  'event-edit': '予定を編集する',
  'event-new': '予定を追加する',
  week: '今週のスケジュール',
  upcoming: '今後のスケジュール',
  free: 'スケジュールの空き',
  settings: '設定',
};
const view = computed(() => {
  switch (panel.value) {
    case 'task-new': return TaskForm;
    case 'task-list': return TaskList;
    case 'task-edit': return TaskEditForm;
    case 'event-edit': return EventEditForm;
    case 'event-new': return EventForm;
    case 'week': return ScheduleView;
    case 'upcoming': return ScheduleView;
    case 'free': return FreeSlots;
    case 'settings': return Settings;
    default: return null;
  }
});
const viewProps = computed(() => (panel.value === 'week' || panel.value === 'upcoming' ? { mode: panel.value } : {}));
const initial = computed(() => (dash.value?.user.displayName ?? '').slice(0, 1).toUpperCase());

const reload = () => window.location.reload();
const toggle = (k: string) => {
  editing.value = null;
  panel.value = panel.value === k ? null : k;
};
const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape') (panel.value === 'task-edit' || panel.value === 'event-edit' ? closeEdit() : (panel.value = null));
};

onMounted(async () => {
  window.addEventListener('keydown', onKey);
  await loadDashboard();
  await refreshAiOnce();
});
onUnmounted(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <div class="app">
    <Sidebar :active="panel === 'task-edit' ? 'task-list' : panel === 'event-edit' ? null : panel" @open="toggle" />
    <main class="main">
      <button class="avatar" :aria-label="`設定を開く(${dash?.user.displayName ?? ''})`" @click="toggle('settings')">{{ initial }}</button>
      <div class="stage">
        <Home />
        <Transition name="slide">
          <aside v-if="panel && view" :key="panel" class="panel" role="dialog" :aria-label="titles[panel]">
            <header>
              <h2>{{ titles[panel] }}</h2>
              <button class="icon" aria-label="閉じる" @click="panel === 'task-edit' || panel === 'event-edit' ? closeEdit() : (panel = null)">✕</button>
            </header>
            <div class="panel-body"><component :is="view" v-bind="viewProps" /></div>
          </aside>
        </Transition>
      </div>
      <AiBar />
    </main>

    <div v-if="sessionExpired" class="banner" role="alert">
      サーバーに接続できませんでした。ログインの有効期限が切れた可能性があります。
      <button class="btn sm" @click="reload">再読み込み</button>
    </div>
    <div class="toasts" aria-live="polite">
      <div v-for="t in toasts" :key="t.id" class="toast">
        {{ t.text }}
        <button v-if="t.undo" class="link" @click="t.undo(); toasts.splice(toasts.findIndex((x) => x.id === t.id), 1)">元に戻す</button>
      </div>
    </div>
  </div>
</template>
