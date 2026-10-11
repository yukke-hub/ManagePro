<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from '../api';
import { dash, loadDashboard, run, toast } from '../store';
import { mdw } from '../util';

const days = ref<{ date: string; slots: string[] }[]>([]);
const loaded = ref(false);
const busy = ref('');

async function load() {
  const r = await run(() => api.get<{ days: { date: string; slots: string[] }[] }>(`/events/free-slots?date=${dash.value!.date}&days=7`));
  if (r) days.value = r.days;
  loaded.value = true;
}
onMounted(load);

async function plan(date: string) {
  busy.value = date;
  const r = await run(() => api.post<{ proposals: unknown[]; message: string; aiLimited: boolean }>('/ai/plan', { date }));
  busy.value = '';
  if (!r) return;
  await loadDashboard();
  await load();
  toast(r.aiLimited ? '今日のAI上限に達したため、ルールで予定案を作りました。' : r.message);
}
</script>

<template>
  <div class="list">
    <p v-if="loaded" class="hint">予定のない時間です(今日は現在時刻以降のみ)。</p>
    <section v-for="d in days" :key="d.date" class="lgroup">
      <h3 :class="{ today: d.date === dash?.date }">{{ mdw(d.date) }}</h3>
      <div class="slots">
        <template v-if="d.slots.length">
          <span v-for="s in d.slots" :key="s" class="slot">{{ s }}</span>
          <button class="link" :disabled="!!busy" @click="plan(d.date)">{{ busy === d.date ? '考え中…' : 'この日の予定案を作る' }}</button>
        </template>
        <span v-else class="empty small">空きなし</span>
      </div>
    </section>
  </div>
</template>
