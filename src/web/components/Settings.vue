<script setup lang="ts">
import { computed, ref } from 'vue';
import { api } from '../api';
import { dash, loadDashboard, run, toast } from '../store';

const name = ref(dash.value?.user.displayName ?? '');
const tz = ref(dash.value?.user.timezone ?? 'Asia/Tokyo');
const workStart = ref(dash.value?.user.workStart ?? '09:00');
const workEnd = ref(dash.value?.user.workEnd ?? '21:00');
const busy = ref(false);

const invalid = computed(() => !name.value.trim() || !workStart.value || !workEnd.value || workEnd.value <= workStart.value);

async function save() {
  if (invalid.value) return;
  busy.value = true;
  const r = await run(
    () =>
      api.patch('/me', {
        displayName: name.value.trim(),
        timezone: tz.value.trim(),
        workStart: workStart.value,
        workEnd: workEnd.value,
      }),
    'タイムゾーンの名前(例: Asia/Tokyo)と稼働時間を確認してください。',
  );
  busy.value = false;
  if (!r) return;
  await loadDashboard();
  toast('保存しました。');
}
</script>

<template>
  <form class="form" @submit.prevent="save">
    <label>表示名(「◯◯さん」と呼ばれます)
      <input v-model="name" type="text" maxlength="30" required />
    </label>
    <label>タイムゾーン
      <input v-model="tz" type="text" list="tzs" required />
      <datalist id="tzs"><option value="Asia/Tokyo" /><option value="UTC" /><option value="America/Los_Angeles" /><option value="Europe/London" /></datalist>
    </label>
    <div class="pair">
      <label>稼働開始 <input v-model="workStart" type="time" required /></label>
      <label>稼働終了 <input v-model="workEnd" type="time" required /></label>
    </div>
    <p class="hint">空き時間の計算やAIの予定案作成は、この時間帯の中で行われます。</p>
    <p v-if="workEnd && workStart && workEnd <= workStart" class="hint err">稼働終了は稼働開始より後にしてください。</p>
    <button class="btn" type="submit" :disabled="busy || invalid">保存</button>
  </form>
</template>
