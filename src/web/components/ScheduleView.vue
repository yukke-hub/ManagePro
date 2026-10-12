<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../api';
import { dash, loadDashboard, openEventEdit, run } from '../store';
import type { EventItem } from '../types';
import { addDays, mdw, range, weekStart } from '../util';

const props = defineProps<{ mode: 'week' | 'upcoming' }>();
const events = ref<EventItem[]>([]);
const loaded = ref(false);

const from = computed(() => (props.mode === 'week' ? weekStart(dash.value!.date) : dash.value!.date));
const to = computed(() => addDays(from.value, props.mode === 'week' ? 6 : 13));

async function load() {
  const r = await run(() => api.get<{ events: EventItem[] }>(`/events?from=${from.value}&to=${to.value}`));
  if (r) events.value = r.events;
  loaded.value = true;
}
onMounted(load);

const days = computed(() => {
  const out: { date: string; items: EventItem[] }[] = [];
  for (let i = 0; i < (props.mode === 'week' ? 7 : 14); i++) {
    const d = addDays(from.value, i);
    const items = events.value.filter((e) => e.start_at.startsWith(d));
    if (props.mode === 'week' || items.length) out.push({ date: d, items });
  }
  return out;
});

async function act(fn: () => Promise<unknown>) {
  if (await run(fn)) {
    await load();
    await loadDashboard();
  }
}
</script>

<template>
  <div class="list">
    <p v-if="loaded && !days.length" class="empty">今後2週間の予定はありません。</p>
    <section v-for="d in days" :key="d.date" class="lgroup">
      <h3 :class="{ today: d.date === dash?.date }">{{ mdw(d.date) }}</h3>
      <p v-if="!d.items.length" class="empty small">予定なし</p>
      <ul>
        <li v-for="e in d.items" :key="e.id" class="lrow ev" :class="{ proposed: e.status === 'proposed' }">
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
