import React, { useState, useEffect, useRef, useCallback } from 'react'
import { chatApi } from '../../api'
import { useAuthStore } from '../../stores'
import { Avatar, Button, Input, Modal, Select, EmptyState } from '../common'
import { cn, formatRelative } from '../../utils'
import type { ChatThread, ChatMessage } from '../../types'

interface Props {
  projectId: string
  blockId?: string
}

export const ChatSpace: React.FC<Props> = ({ projectId, blockId }) => {
  const { user } = useAuthStore()
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [activeThread, setActiveThread] = useState<ChatThread | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [addThreadModal, setAddThreadModal] = useState(false)
  const [editThreadModal, setEditThreadModal] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastMsgTime = useRef<string | undefined>(undefined)

  useEffect(() => { loadThreads() }, [projectId])
  useEffect(() => { if (activeThread) startPolling() }, [activeThread])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function loadThreads() {
    try {
      const res = await chatApi.getThreads(projectId)
      setThreads(res.data)
      if (res.data.length > 0 && !activeThread) {
        selectThread(res.data[0])
      }
    } catch {}
  }

  async function selectThread(thread: ChatThread) {
    setActiveThread(thread)
    setMessages([])
    lastMsgTime.current = undefined
    try {
      const res = await chatApi.getMessages(thread.id)
      setMessages(res.data)
      if (res.data.length > 0) lastMsgTime.current = res.data[res.data.length - 1].created_at
    } catch {}
  }

  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      if (!activeThread) return
      try {
        const res = await chatApi.getMessages(activeThread.id, lastMsgTime.current)
        if (res.data.length > 0) {
          setMessages((prev) => [...prev, ...res.data])
          lastMsgTime.current = res.data[res.data.length - 1].created_at
        }
      } catch {}
    }, 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  async function sendMessage() {
    if (!newMsg.trim() || !activeThread || sending) return
    setSending(true)
    try {
      const res = await chatApi.sendMessage(activeThread.id, { content: newMsg.trim() })
      setMessages((prev) => [...prev, res.data])
      setNewMsg('')
    } catch {} finally { setSending(false) }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <div className="flex h-[520px] bg-white rounded-2xl border border-silver overflow-hidden">
      {/* ── Thread Sidebar ── */}
      <div className="w-52 border-r border-silver flex flex-col flex-shrink-0">
        <div className="flex items-center justify-between px-3 py-3 border-b border-silver">
          <span className="text-xs font-semibold text-[#999] uppercase tracking-wider">スレッド</span>
          <button onClick={() => setAddThreadModal(true)}
            className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-snow text-violet text-lg leading-none">
            +
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {threads.length === 0 ? (
            <p className="text-xs text-[#bbb] text-center py-6">スレッドなし</p>
          ) : threads.map((t) => (
            <button
              key={t.id}
              onClick={() => selectThread(t)}
              className={cn(
                'w-full flex flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-snow transition-colors',
                activeThread?.id === t.id && 'bg-violet/5 border-r-2 border-violet'
              )}
            >
              <span className={cn('text-sm font-medium truncate', activeThread?.id === t.id ? 'text-violet' : 'text-ink')}>
                # {t.name}
              </span>
              {t.last_message && (
                <span className="text-xs text-[#bbb] truncate">{t.last_message}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Chat Area ── */}
      {activeThread ? (
        <div className="flex-1 flex flex-col">
          {/* Thread Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-silver">
            <div>
              <h4 className="font-semibold text-sm"># {activeThread.name}</h4>
              {activeThread.description && <p className="text-xs text-[#999]">{activeThread.description}</p>}
            </div>
            <button onClick={() => setEditThreadModal(true)}
              className="text-xs text-[#999] hover:text-ink transition-colors px-2 py-1 rounded-lg hover:bg-snow">
              ⚙️
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {messages.length === 0 ? (
              <EmptyState icon="💬" title="まだメッセージがありません" description="最初のメッセージを送りましょう" />
            ) : (
              messages.map((msg, i) => {
                const isMe = msg.user_id === user?.id
                const showAvatar = i === 0 || messages[i - 1].user_id !== msg.user_id

                return (
                  <div key={msg.id} className={cn('flex gap-2.5 group', isMe && 'flex-row-reverse')}>
                    {showAvatar
                      ? <Avatar name={msg.username} src={msg.avatar_url} size="sm" className="flex-shrink-0 mt-0.5" />
                      : <div className="w-7 flex-shrink-0" />
                    }
                    <div className={cn('max-w-[72%]', isMe && 'items-end flex flex-col')}>
                      {showAvatar && (
                        <div className={cn('flex items-baseline gap-2 mb-1', isMe && 'flex-row-reverse')}>
                          <span className="text-xs font-semibold">{msg.username}</span>
                          <span className="text-[11px] text-[#bbb]">{formatRelative(msg.created_at)}</span>
                        </div>
                      )}
                      <div className={cn(
                        'px-3 py-2 rounded-2xl text-sm leading-relaxed',
                        isMe
                          ? 'bg-violet text-white rounded-tr-sm'
                          : 'bg-snow text-ink rounded-tl-sm'
                      )}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-silver">
            <div className="flex items-center gap-2 bg-snow rounded-xl px-3 py-2">
              <textarea
                className="flex-1 bg-transparent text-sm resize-none outline-none max-h-24"
                rows={1}
                placeholder={`# ${activeThread.name} にメッセージを送る`}
                value={newMsg}
                onChange={(e) => setNewMsg(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                onClick={sendMessage}
                disabled={!newMsg.trim() || sending}
                className="w-8 h-8 bg-violet text-white rounded-lg flex items-center justify-center disabled:opacity-40 transition-opacity hover:bg-violet-dark"
              >
                ↑
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState icon="💬" title="スレッドを選択してください" description="左からスレッドを選ぶか、新しく作成しましょう"
            action={<Button size="sm" onClick={() => setAddThreadModal(true)}>スレッドを作成</Button>} />
        </div>
      )}

      {/* Add Thread Modal */}
      <ThreadFormModal
        open={addThreadModal}
        onClose={() => setAddThreadModal(false)}
        projectId={projectId}
        blockId={blockId}
        onSaved={() => { setAddThreadModal(false); loadThreads() }}
      />

      {/* Edit Thread Modal */}
      {editThreadModal && activeThread && (
        <ThreadFormModal
          open={editThreadModal}
          onClose={() => setEditThreadModal(false)}
          projectId={projectId}
          blockId={blockId}
          thread={activeThread}
          onSaved={() => { setEditThreadModal(false); loadThreads() }}
        />
      )}
    </div>
  )
}

const ThreadFormModal: React.FC<{
  open: boolean; onClose: () => void;
  projectId: string; blockId?: string;
  thread?: ChatThread; onSaved: () => void
}> = ({ open, onClose, projectId, blockId, thread, onSaved }) => {
  const [form, setForm] = useState({ name: '', description: '', permission: 'all' as 'all' | 'restricted' })

  useEffect(() => {
    if (thread) setForm({ name: thread.name, description: thread.description, permission: thread.permission })
    else setForm({ name: '', description: '', permission: 'all' })
  }, [thread, open])

  async function submit() {
    if (!form.name.trim()) return
    if (thread) {
      await chatApi.updateThread(thread.id, form)
    } else {
      await chatApi.createThread({ ...form, project_id: projectId, block_id: blockId })
    }
    onSaved()
  }

  return (
    <Modal open={open} onClose={onClose} title={thread ? 'スレッドを編集' : 'スレッドを作成'}>
      <div className="space-y-3">
        <Input label="スレッド名 *" placeholder="例: 全体連絡、デザインレビュー" value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input label="説明" placeholder="このスレッドの説明" value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <Select label="権限設定" value={form.permission}
          onChange={(e) => setForm({ ...form, permission: e.target.value as 'all' | 'restricted' })}>
          <option value="all">全員が閲覧・書き込み可能</option>
          <option value="restricted">限定公開（存在も非表示）</option>
        </Select>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="ghost" onClick={onClose}>キャンセル</Button>
        <Button onClick={submit}>{thread ? '保存' : '作成'}</Button>
      </div>
    </Modal>
  )
}
