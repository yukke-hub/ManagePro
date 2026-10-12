<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { api } from '../api';
import { dash, loadDashboard, openEventEdit, run } from '../store';
import type { EventItem } from '../types';
import { addDays, mdw, range, WEEK_JA, weekStart } from '../util';

const monthStart = ref(''); // その月の1日
const selected = ref(''); // 選択中の日
const events = ref<EventItem[]>([]);
const loaded = ref(false);

function initMonth() {
  const today = dash.value?.date;
  if (!today) return;
  monthStart.value = `${today.slice(0, 7)}-01`;
  selected.value = today;
}

const gridStart = computed(() => (monthStart.value ? weekStart(monthStart.value) : ''));
const monthLabel = computed(() => (monthStart.value ? `${Number(monthStart.value.slice(0, 4))}年${Number(monthStart.value.slice(5, 7))}月` : ''));

// 月をまたぐ週も含め、常に 6 週間(42 日)分のグリッドを表示する
const weeks = computed(() => {
  if (!monthStart.value) return [];
  const month = monthStart.value.slice(0, 7);
  const out: { date: string; inMonth: boolean }[][] = [];
  let d = gridStart.value;
  for (let w = 0; w < 6; w++) {
    const row: { date: string; inMonth: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      row.push({ date: d, inMonth: d.startsWith(month) });
      d = addDays(d, 1);
    }
    out.push(row);
  }
  return out;
});

const countByDate = computed(() => {
  const m = new Map<string, number>();
  for (const e of events.value) m.set(e.start_at.slice(0, 10), (m.get(e.start_at.slice(0, 10)) ?? 0) + 1);
  return m;
});

async function load() {
  if (!gridStart.value) return;
  loaded.value = false;
  const to = addDays(gridStart.value, 41); // 6週間ぶん
  const r = await run(() => api.get<{ events: EventItem[] }>(`/events?from=${gridStart.value}&to=${to}`));
  if (r) events.value = r.events;
  loaded.value = true;
}
onMounted(() => {
  initMonth();
  load();
});
watch(monthStart, load);

function changeMonth(n: number) {
  const d = new Date(`${monthStart.value}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  monthStart.value = d.toISOString().slice(0, 8) + '01';
}
function pick(date: string) {
  selected.value = date;
}

const dayEvents = computed(() => events.value.filter((e) => e.start_at.startsWith(selected.value)).sort((a, b) => (a.start_at < b.start_at ? -1 : 1)));

async function act(fn: () => Promise<unknown>) {
  if (await run(fn)) {
    await load();
    await loadDashboard();
  }
}
</script>

<template>
  <div class="calendar">
    <div class="cal-head">
      <button class="icon" aria-label="前の月" @click="changeMonth(-1)">‹</button>
      <h3>{{ monthLabel }}</h3>
      <button class="icon" aria-label="次の月" @click="changeMonth(1)">›</button>
    </div>
    <div class="cal-grid">
      <div v-for="w in WEEK_JA" :key="w" class="cal-dow">{{ w }}</div>
      <template v-for="row in weeks" :key="row[0].date">
        <button
          v-for="cell in row"
          :key="cell.date"
          type="button"
          class="cal-cell"
          :class="{ out: !cell.inMonth, today: cell.date === dash?.date, selected: cell.date === selected }"
          @click="pick(cell.date)"
        >
          <span class="cal-day">{{ Number(cell.date.slice(8, 10)) }}</span>
          <span v-if="countByDate.get(cell.date)" class="cal-dot">{{ countByDate.get(cell.date) }}</span>
        </button>
      </template>
    </div>

    <section class="lgroup cal-day-list">
      <h3 :class="{ today: selected === dash?.date }">{{ mdw(selected) }}の予定</h3>
      <p v-if="loaded && !dayEvents.length" class="empty small">予定なし</p>
      <ul>
        <li v-for="e in dayEvents" :key="e.id" class="lrow ev" :class="{ proposed: e.status === 'proposed' }">
          <span class="e-time">{{ range(e) }}</span>
          <span class="t-title">{{ e.title }}<span v-if="e.status === 'proposed'" class="tag">提案</span></span>
          <span class="row-actions">
            <button v-if="e.status === 'proposed'" class="btn sm" @click="act(() => api.post(`/events/${e.id}/approve`))">承認</button>
            <button v-if="e.status === 'confirmed'" class="edit" :aria-label="`${e.title}を編集`" @click="openEventEdit(e)">編集</button>
            <button class="link danger" :aria-label="`${e.title}を${e.status === 'proposed' ? '却下' : '削除'}`" @click="act(() => api.del(`/events/${e.id}`))">
              {{ e.status === 'proposed' ? '却下' : '削除' }}
            </button>
          </span>
        </li>
      </ul>
    </section>
  </div>
</template>
