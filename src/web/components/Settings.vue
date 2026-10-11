<script setup lang="ts">
import { ref } from 'vue';
import { api } from '../api';
import { dash, loadDashboard, run, toast } from '../store';

const name = ref(dash.value?.user.displayName ?? '');
const tz = ref(dash.value?.user.timezone ?? 'Asia/Tokyo');
const busy = ref(false);

async function save() {
  busy.value = true;
  const r = await run(() => api.patch('/me', { displayName: name.value.trim(), timezone: tz.value.trim() }), 'タイムゾーンの名前を確認してください(例: Asia/Tokyo)。');
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
    <button class="btn" type="submit" :disabled="busy || !name.trim()">保存</button>
  </form>
</template>
