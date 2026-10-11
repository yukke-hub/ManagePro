<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from '../api';
import { dash, loadDashboard, run, toast } from '../store';
import { addDays } from '../util';

const title = ref('');
const project = ref('');
const due = ref('');
const est = ref<number | ''>('');
const criteria = ref('');
const notes = ref('');
const more = ref(false);
const busy = ref(false);
const projects = ref<string[]>([]);
const titleEl = ref<HTMLInputElement | null>(null);

onMounted(async () => {
  titleEl.value?.focus();
  const r = await run(() => api.get<{ projects: { name: string }[] }>('/tasks/projects'));
  if (r) projects.value = r.projects.map((p) => p.name);
});

const setDue = (n: number) => (due.value = addDays(dash.value!.date, n));

async function submit() {
  if (!title.value.trim() || busy.value) return;
  busy.value = true;
  const r = await run(() =>
    api.post('/tasks', {
      title: title.value.trim(),
      project: project.value.trim() || null,
      due_date: due.value || null,
      est_minutes: est.value || null,
      done_criteria: criteria.value.trim() || null,
      notes: notes.value.trim() || null,
    }),
  );
  busy.value = false;
  if (!r) return;
  toast('タスクを追加しました。');
  title.value = criteria.value = notes.value = '';
  await loadDashboard();
  titleEl.value?.focus();
}
</script>

<template>
  <form class="form" @submit.prevent="submit">
    <label>タスク名
      <input ref="titleEl" v-model="title" type="text" maxlength="200" required />
    </label>
    <label>プロジェクト
      <input v-model="project" type="text" maxlength="60" list="projects" placeholder="任意" />
      <datalist id="projects"><option v-for="p in projects" :key="p" :value="p" /></datalist>
    </label>
    <div class="field">
      <label>期限
        <input v-model="due" type="date" />
      </label>
      <div class="chips">
        <button type="button" class="chip" @click="setDue(0)">今日</button>
        <button type="button" class="chip" @click="setDue(1)">明日</button>
        <button type="button" class="chip" @click="setDue(7)">1週間後</button>
      </div>
    </div>
    <label>かかる時間
      <select v-model="est">
        <option value="">未設定</option>
        <option v-for="m in [15, 30, 45, 60, 90, 120, 180, 240]" :key="m" :value="m">{{ m }}分</option>
      </select>
    </label>
    <button type="button" class="link" @click="more = !more">{{ more ? '詳細を閉じる' : '完了条件・メモを追加' }}</button>
    <template v-if="more">
      <label>完了条件
        <input v-model="criteria" type="text" maxlength="500" />
      </label>
      <label>メモ
        <textarea v-model="notes" rows="3" maxlength="2000"></textarea>
      </label>
    </template>
    <button class="btn" type="submit" :disabled="busy || !title.trim()">タスクを追加</button>
  </form>
</template>
