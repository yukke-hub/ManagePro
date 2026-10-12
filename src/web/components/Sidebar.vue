<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { dash } from '../store';
import { dow, nowIn, WEEK_EN } from '../util';

defineProps<{ active: string | null }>();
defineEmits<{ open: [key: string] }>();

const tz = computed(() => dash.value?.user.timezone ?? 'Asia/Tokyo');
const now = ref(nowIn(tz.value));
let timer: number | undefined;
onMounted(() => (timer = window.setInterval(() => (now.value = nowIn(tz.value)), 15000)));
onUnmounted(() => clearInterval(timer));
const dateLabel = computed(() => {
  const d = now.value.date;
  return `${Number(d.slice(5, 7))} / ${Number(d.slice(8, 10))} (${WEEK_EN[dow(d)]})`;
});

const groups = [
  { title: 'Tasks', items: [['task-new', 'タスクを追加する'], ['task-list', '今後のタスクを確認する']] },
  {
    title: 'Schedule',
    items: [
      ['event-new', '予定を追加する'],
      ['week', '今週のスケジュールをみる'],
      ['upcoming', '今後のスケジュールをみる'],
      ['calendar', 'カレンダーで見る'],
      ['free', 'スケジュールの空きをみる'],
    ],
  },
];
</script>

<template>
  <nav class="side" aria-label="メニュー">
    <div v-for="g in groups" :key="g.title" class="group">
      <h2 class="hd">{{ g.title }}</h2>
      <ul>
        <li v-for="[key, label] in g.items" :key="key">
          <button class="menu" :aria-current="active === key ? 'true' : undefined" @click="$emit('open', key)">{{ label }}</button>
        </li>
      </ul>
    </div>
    <div class="clock">
      <div class="clock-date">{{ dateLabel }}</div>
      <div class="clock-time">{{ now.time }}</div>
    </div>
  </nav>
</template>
