<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../api';
import { dash, loadDashboard, run, toast } from '../store';

const title = ref('');
const date = ref(dash.value?.date ?? '');
const start = ref('09:00');
const end = ref('10:00');
const busy = ref(false);
const titleEl = ref<HTMLInputElement | null>(null);
onMounted(() => titleEl.value?.focus());

const invalid = computed(() => !title.value.trim() || !date.value || !start.value || !end.value || end.value <= start.value);

async function submit() {
  if (invalid.value || busy.value) return;
  busy.value = true;
  const r = await run(() =>
    api.post('/events', { title: title.value.trim(), start_at: `${date.value}T${start.value}`, end_at: `${date.value}T${end.value}` }),
  );
  busy.value = false;
  if (!r) return;
  toast('予定を追加しました。');
  title.value = '';
  await loadDashboard();
  titleEl.value?.focus();
}
</script>

<template>
  <form class="form" @submit.prevent="submit">
    <label>予定名
      <input ref="titleEl" v-model="title" type="text" maxlength="200" required />
    </label>
    <label>日付
      <input v-model="date" type="date" required />
    </label>
    <div class="pair">
      <label>開始 <input v-model="start" type="time" required /></label>
      <label>終了 <input v-model="end" type="time" required /></label>
    </div>
    <p v-if="end <= start" class="hint err">終了は開始より後の時刻にしてください。</p>
    <button class="btn" type="submit" :disabled="busy || invalid">予定を追加</button>
  </form>
</template>
