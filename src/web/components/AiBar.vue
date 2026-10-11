<script setup lang="ts">
import { ref } from 'vue';
import { api } from '../api';
import { dash, loadDashboard, run } from '../store';

const text = ref('');
const busy = ref(false);
const reply = ref('');
const examples = ['今日の予定案を作って', '明日の空きを教えて'];

async function send(msg?: string) {
  const m = (msg ?? text.value).trim();
  if (!m || busy.value) return;
  busy.value = true;
  const r = await run(() => api.post<{ reply: string; changed: boolean }>('/ai/chat', { message: m }));
  busy.value = false;
  if (!r) return;
  reply.value = r.reply;
  text.value = '';
  if (r.changed) await loadDashboard();
}
// 日本語入力の変換確定の Enter では送信しない
const onEnter = (e: KeyboardEvent) => {
  if (!e.isComposing) send();
};
</script>

<template>
  <div class="aibar">
    <p v-if="reply" class="reply" role="status">
      <span>{{ reply }}</span>
      <button class="icon" aria-label="返事を閉じる" @click="reply = ''">✕</button>
    </p>
    <div class="ai-row">
      <input
        v-model="text"
        type="text"
        maxlength="500"
        placeholder="AIにスケジュール管理を依頼する…"
        aria-label="AIへの依頼"
        :disabled="busy"
        @keydown.enter="onEnter"
      />
      <button class="send" :disabled="busy || !text.trim()" aria-label="送信" @click="send()">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>
    <div class="ai-meta">
      <span v-if="busy">考え中…</span>
      <template v-else>
        <button v-for="x in examples" :key="x" class="link" @click="send(x)">{{ x }}</button>
      </template>
      <span v-if="dash" class="quota">今日のAI残り {{ dash.aiRemaining }}回</span>
    </div>
  </div>
</template>
