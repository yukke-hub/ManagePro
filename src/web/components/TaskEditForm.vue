<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from '../api';
import { closeEdit, editing, loadDashboard, run, toast } from '../store';

// 編集対象は openEdit() で渡された値のコピーを使う(保存するまで元データは変えない)
const t = editing.value!;
const title = ref(t.title);
const project = ref(t.project_name ?? '');
const due = ref(t.due_date ?? '');
const urgency = ref(t.urgency ?? 3);
const priority = ref(t.priority ?? 3);
const est = ref<number | ''>(t.est_minutes ?? '');
const criteria = ref(t.done_criteria ?? '');
const notes = ref(t.notes ?? '');
const status = ref(t.status);
const busy = ref(false);
const projects = ref<string[]>([]);
const titleEl = ref<HTMLInputElement | null>(null);

onMounted(async () => {
  titleEl.value?.focus();
  const r = await run(() => api.get<{ projects: { name: string }[] }>('/tasks/projects'));
  if (r) projects.value = r.projects.map((p) => p.name);
});

async function save() {
  if (!title.value.trim() || !due.value || busy.value) return;
  busy.value = true;
  const r = await run(() =>
    api.patch(`/tasks/${t.id}`, {
      title: title.value.trim(),
      project: project.value.trim() || null,
      due_date: due.value,
      urgency: urgency.value,
      priority: priority.value,
      est_minutes: est.value || null,
      done_criteria: criteria.value.trim() || null,
      notes: notes.value.trim() || null,
      status: status.value,
    }),
  );
  busy.value = false;
  if (!r) return;
  await loadDashboard();
  toast('タスクを更新しました。');
  closeEdit();
}
</script>

<template>
  <form class="form" @submit.prevent="save">
    <label>タスク名
      <input ref="titleEl" v-model="title" type="text" maxlength="200" required />
    </label>
    <label>プロジェクト
      <input v-model="project" type="text" maxlength="60" list="projects-edit" placeholder="任意" />
      <datalist id="projects-edit"><option v-for="p in projects" :key="p" :value="p" /></datalist>
    </label>
    <div class="pair">
      <label>期限<span class="req">必須</span> <input v-model="due" type="date" required /></label>
      <label>かかる時間
        <select v-model="est">
          <option value="">未設定</option>
          <option v-for="m in [15, 30, 45, 60, 90, 120, 180, 240]" :key="m" :value="m">{{ m }}分</option>
          <option v-if="est && ![15, 30, 45, 60, 90, 120, 180, 240].includes(Number(est))" :value="est">{{ est }}分</option>
        </select>
      </label>
    </div>
    <p v-if="!due" class="hint err">締切を入力してください。</p>
    <div class="pair">
      <label>緊急度
        <select v-model.number="urgency">
          <option v-for="n in [1, 2, 3, 4, 5]" :key="n" :value="n">{{ n }}{{ n === 1 ? '(低い)' : n === 5 ? '(高い)' : '' }}</option>
        </select>
      </label>
      <label>優先度
        <select v-model.number="priority">
          <option v-for="n in [1, 2, 3, 4, 5]" :key="n" :value="n">{{ n }}{{ n === 1 ? '(低い)' : n === 5 ? '(高い)' : '' }}</option>
        </select>
      </label>
    </div>
    <label>状態
      <select v-model="status">
        <option value="todo">未着手</option>
        <option value="doing">進行中</option>
        <option value="done">完了</option>
      </select>
    </label>
    <label>完了条件 <input v-model="criteria" type="text" maxlength="500" /></label>
    <label>メモ <textarea v-model="notes" rows="3" maxlength="2000"></textarea></label>
    <div class="form-actions">
      <button class="btn" type="submit" :disabled="busy || !title.trim() || !due">保存</button>
      <button class="link" type="button" @click="closeEdit()">キャンセル</button>
    </div>
  </form>
</template>
