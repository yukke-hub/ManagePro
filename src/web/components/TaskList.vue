<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { api } from '../api';
import { completeTask, dash, listTab, loadDashboard, openEdit, reopenTask, run, toast } from '../store';
import type { Task } from '../types';
import { addDays, md } from '../util';

const tasks = ref<Task[]>([]);
const loaded = ref(false);

async function load() {
  loaded.value = false;
  tasks.value = []; // タブ切り替え中に前のタブの行が残らないようにする
  const r = await run(() => api.get<{ tasks: Task[] }>(`/tasks?status=${listTab.value}`));
  if (r) tasks.value = r.tasks;
  loaded.value = true;
}
onMounted(load);
watch(listTab, load);

const groups = computed(() => {
  const today = dash.value?.date ?? '';
  const week = addDays(today, 7);
  const g: Record<string, Task[]> = { 期限超過: [], 今日: [], '1週間以内': [], それ以降: [], 期限なし: [] };
  for (const t of tasks.value) {
    if (!t.due_date) g['期限なし'].push(t);
    else if (t.due_date < today) g['期限超過'].push(t);
    else if (t.due_date === today) g['今日'].push(t);
    else if (t.due_date <= week) g['1週間以内'].push(t);
    else g['それ以降'].push(t);
  }
  for (const v of Object.values(g)) v.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return Object.entries(g).filter(([, v]) => v.length);
});

// チェック ON → 完了 / 完了済みタブでチェック OFF → 未完了に戻す。失敗したらチェックを戻す
async function complete(t: Task, ev: Event) {
  if (await completeTask(t.id, t.title)) await load();
  else (ev.target as HTMLInputElement).checked = false;
}
async function reopen(t: Task, ev: Event) {
  if (await reopenTask(t.id)) {
    toast('未完了に戻しました。');
    await load();
  } else (ev.target as HTMLInputElement).checked = true;
}
async function remove(t: Task) {
  if (!window.confirm(`「${t.title}」を削除しますか?`)) return;
  if (await run(() => api.del(`/tasks/${t.id}`))) {
    await load();
    await loadDashboard();
  }
}
const meta = (t: Task) =>
  [
    t.project_name,
    listTab.value === 'done' ? (t.completed_on ? `${md(t.completed_on)}に完了` : null) : t.due_date ? `${md(t.due_date)}まで` : null,
    t.est_minutes ? `${t.est_minutes}分` : null,
  ].filter(Boolean).join(' / ');
</script>

<template>
  <div class="list">
    <div class="tabs" role="tablist">
      <button class="tab" role="tab" :aria-selected="listTab === 'open'" @click="listTab = 'open'">未完了</button>
      <button class="tab" role="tab" :aria-selected="listTab === 'done'" @click="listTab = 'done'">完了済み</button>
    </div>

    <p v-if="loaded && listTab === 'open' && !groups.length" class="empty">未完了のタスクはありません。</p>
    <p v-if="loaded && listTab === 'done' && !tasks.length" class="empty">完了したタスクはまだありません。</p>

    <template v-if="listTab === 'open'">
      <section v-for="[name, items] in groups" :key="name" class="lgroup">
        <h3>{{ name }}</h3>
        <ul>
          <li v-for="t in items" :key="t.id" class="lrow">
            <label class="check">
              <input type="checkbox" :aria-label="`${t.title}を完了にする`" @change="complete(t, $event)" />
              <span class="box" aria-hidden="true"></span>
              <span class="t-title">{{ t.title }}<span v-if="t.status === 'doing'" class="tag">進行中</span></span>
            </label>
            <span v-if="t.score != null" class="score" title="緊急度・優先度・締切から計算した推奨スコア">{{ Math.round(t.score) }}点</span>
            <span class="meta">{{ meta(t) }}</span>
            <button class="edit" :aria-label="`${t.title}を編集`" @click="openEdit(t)">編集</button>
            <button class="link danger" :aria-label="`${t.title}を削除`" @click="remove(t)">削除</button>
          </li>
        </ul>
      </section>
    </template>

    <ul v-else class="done-list">
      <li v-for="t in tasks" :key="t.id" class="lrow">
        <label class="check">
          <input type="checkbox" checked :aria-label="`${t.title}を未完了に戻す`" @change="reopen(t, $event)" />
          <span class="box" aria-hidden="true"></span>
          <span class="t-title">{{ t.title }}</span>
        </label>
        <span class="meta">{{ meta(t) }}</span>
        <button class="edit" :aria-label="`${t.title}を編集`" @click="openEdit(t)">編集</button>
        <button class="link danger" :aria-label="`${t.title}を削除`" @click="remove(t)">削除</button>
      </li>
    </ul>
  </div>
</template>
