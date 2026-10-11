<script setup lang="ts">
import { computed, ref } from 'vue';
import { api } from '../api';
import { completeTask, dash, loadDashboard, openEdit, openEventEdit, run, toast } from '../store';
import type { EventItem } from '../types';
import { md, range } from '../util';

const rec = computed(() => dash.value?.recommended);
const events = computed(() => dash.value?.events ?? []);
const hasProposed = computed(() => events.value.some((e) => e.status === 'proposed'));
const canPlan = computed(() => (dash.value?.openCount ?? 0) > 0 && !hasProposed.value);
const busyPlan = ref(false);

const late = (d: string | null) => !!d && !!dash.value && d < dash.value.date;

async function done(t: { id: number; title: string }, ev: Event) {
  const box = ev.target as HTMLInputElement;
  if (!(await completeTask(t.id, t.title))) box.checked = false;
}

async function plan() {
  busyPlan.value = true;
  const r = await run(() => api.post<{ proposals: unknown[]; message: string; aiLimited: boolean }>('/ai/plan', {}));
  busyPlan.value = false;
  if (!r) return;
  await loadDashboard();
  toast(r.aiLimited ? '今日のAI上限に達したため、ルールで予定案を作りました。' : r.message);
}
async function approveAll() {
  if (await run(() => api.post('/events/approve', { date: dash.value!.date }))) {
    await loadDashboard();
    toast('予定を確定しました。');
  }
}
async function approve(e: EventItem) {
  if (await run(() => api.post(`/events/${e.id}/approve`))) await loadDashboard();
}
async function reject(e: EventItem) {
  if (await run(() => api.del(`/events/${e.id}`))) await loadDashboard();
}
</script>

<template>
  <section class="home">
    <template v-if="dash && rec">
      <div class="cols">
        <div class="col">
          <h2 class="hd">&lt;今日の実行推奨タスク&gt;</h2>
          <ul v-if="rec.tasks.length" class="tasks">
            <li v-for="t in rec.tasks" :key="t.id" class="task-row">
              <label class="check" :title="t.project_name ?? ''">
                <input type="checkbox" :aria-label="`${t.title}を完了にする`" @change="done(t, $event)" />
                <span class="box" aria-hidden="true"></span>
                <span class="t-title">{{ t.title }}</span>
                <span v-if="t.due_date" class="t-due" :class="{ late: late(t.due_date) }">| {{ md(t.due_date) }}まで</span>
              </label>
              <button class="edit" :aria-label="`${t.title}を編集`" @click="openEdit(t, null)">編集</button>
            </li>
          </ul>
          <p v-else class="empty">今日やることはありません。「タスクを追加する」から始めましょう。</p>
          <p v-if="rec.reason" class="why">{{ rec.reason }}</p>
        </div>

        <div class="col">
          <h2 class="hd">&lt;今日の予定&gt;</h2>
          <ul v-if="events.length" class="events">
            <li v-for="e in events" :key="e.id" class="event-row" :class="{ proposed: e.status === 'proposed' }">
              <div class="event-main">
                <div class="e-title">
                  {{ e.title }}<span v-if="e.status === 'proposed'" class="tag">提案</span>
                </div>
                <div class="e-time">
                  - {{ range(e) }}
                  <span v-if="e.status === 'proposed'" class="e-actions">
                    <button class="link" @click="approve(e)">承認</button>
                    <button class="link danger" @click="reject(e)">却下</button>
                  </span>
                </div>
              </div>
              <button v-if="e.status === 'confirmed'" class="edit" :aria-label="`${e.title}を編集`" @click="openEventEdit(e, null)">編集</button>
            </li>
          </ul>
          <p v-else class="empty">今日の予定はまだありません。</p>
          <div class="col-actions">
            <button v-if="hasProposed" class="btn" @click="approveAll">まとめて承認</button>
            <button v-if="canPlan" class="link" :disabled="busyPlan" @click="plan">
              {{ busyPlan ? '考え中…' : 'AIで予定案を作る' }}
            </button>
          </div>
        </div>
      </div>

      <div class="rules" aria-hidden="true"><hr /><hr /></div>
      <p class="cheer">{{ dash.cheer.text }}</p>
    </template>
    <p v-else class="empty center">読み込み中…</p>
  </section>
</template>
