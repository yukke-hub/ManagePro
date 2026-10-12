<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import AiBar from './components/AiBar.vue';
import Calendar from './components/Calendar.vue';
import EventEditForm from './components/EventEditForm.vue';
import EventForm from './components/EventForm.vue';
import FreeSlots from './components/FreeSlots.vue';
import Home from './components/Home.vue';
import ScheduleView from './components/ScheduleView.vue';
import Settings from './components/Settings.vue';
import Sidebar from './components/Sidebar.vue';
import TaskEditForm from './components/TaskEditForm.vue';
import TaskForm from './components/TaskForm.vue';
import TaskList from './components/TaskList.vue';
import { closeEdit, dash, leftView, loadDashboard, panel, scheduleMode, sessionExpired, setLeft, toasts } from './store';

const rightTitles: Record<string, string> = {
  'task-new': 'タスクを追加する',
  'task-edit': 'タスクを編集する',
  'event-new': '予定を追加する',
  'event-edit': '予定を編集する',
  settings: '設定',
};

// 左ペイン: タスク一覧 / 予定一覧は常にここに表示する
const leftComponent = computed(() => {
  if (leftView.value === 'tasks') return TaskList;
  if (leftView.value === 'schedule') {
    if (scheduleMode.value === 'calendar') return Calendar;
    if (scheduleMode.value === 'free') return FreeSlots;
    return ScheduleView;
  }
  return Home;
});
const leftProps = computed(() =>
  leftView.value === 'schedule' && (scheduleMode.value === 'week' || scheduleMode.value === 'upcoming')
    ? { mode: scheduleMode.value }
    : {},
);

// 右ペイン: 追加・編集・設定などの操作カード。開いているときだけ表示する
const rightComponent = computed(() => {
  switch (panel.value) {
    case 'task-new': return TaskForm;
    case 'task-edit': return TaskEditForm;
    case 'event-new': return EventForm;
    case 'event-edit': return EventEditForm;
    case 'settings': return Settings;
    default: return null;
  }
});

const sideActive = computed(() => {
  if (panel.value === 'task-edit') return 'task-list';
  if (panel.value === 'event-edit') return null;
  if (panel.value === 'task-new' || panel.value === 'event-new') return panel.value;
  if (leftView.value === 'tasks') return 'task-list';
  if (leftView.value === 'schedule') return scheduleMode.value;
  return null;
});

const initial = computed(() => (dash.value?.user.displayName ?? '').slice(0, 1).toUpperCase());

const reload = () => window.location.reload();
const closeRight = () => (panel.value === 'task-edit' || panel.value === 'event-edit' ? closeEdit() : (panel.value = null));
const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && panel.value) closeRight();
};

onMounted(async () => {
  window.addEventListener('keydown', onKey);
  await loadDashboard();
});
onUnmounted(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <div class="app">
    <Sidebar :active="sideActive" @open="setLeft" />
    <main class="main">
      <button class="avatar" :aria-label="`設定を開く(${dash?.user.displayName ?? ''})`" @click="setLeft('settings')">{{ initial }}</button>
      <div class="stage" :class="{ split: !!rightComponent }">
        <div class="left-pane">
          <component :is="leftComponent" v-bind="leftProps" />
        </div>
        <Transition name="slide">
          <aside v-if="rightComponent && panel" class="panel" role="dialog" :aria-label="rightTitles[panel]">
            <header>
              <h2>{{ rightTitles[panel] }}</h2>
              <button class="icon" aria-label="閉じる" @click="closeRight">✕</button>
            </header>
            <div class="panel-body"><component :is="rightComponent" /></div>
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
