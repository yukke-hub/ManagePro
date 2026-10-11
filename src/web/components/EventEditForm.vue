<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../api';
import { closeEdit, editingEvent, loadDashboard, run, toast } from '../store';

const e = editingEvent.value!;
const title = ref(e.title);
const date = ref(e.start_at.slice(0, 10));
const start = ref(e.start_at.slice(11));
const end = ref(e.end_at.slice(11));
const busy = ref(false);
const titleEl = ref<HTMLInputElement | null>(null);
onMounted(() => titleEl.value?.focus());

const invalid = computed(() => !title.value.trim() || !date.value || end.value <= start.value);

async function save() {
  if (invalid.value || busy.value) return;
  busy.value = true;
  const r = await run(() =>
    api.patch(`/events/${e.id}`, { title: title.value.trim(), start_at: `${date.value}T${start.value}`, end_at: `${date.value}T${end.value}` }),
  );
  busy.value = false;
  if (!r) return;
  await loadDashboard();
  toast('予定を更新しました。');
  closeEdit();
}
async function remove() {
  if (!window.confirm(`「${e.title}」を削除しますか?`)) return;
  busy.value = true;
  const r = await run(() => api.del(`/events/${e.id}`));
  busy.value = false;
  if (!r) return;
  await loadDashboard();
  toast('予定を削除しました。');
  closeEdit();
}
</script>

<template>
  <form class="form" @submit.prevent="save">
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
    <div class="form-actions">
      <button class="btn" type="submit" :disabled="busy || invalid">保存</button>
      <button class="link" type="button" :disabled="busy" @click="closeEdit()">キャンセル</button>
      <button class="link danger" type="button" :disabled="busy" @click="remove">削除</button>
    </div>
  </form>
</template>
