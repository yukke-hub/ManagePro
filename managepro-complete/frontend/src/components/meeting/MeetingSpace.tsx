import React, { useState, useEffect, useRef } from 'react'
import { meetingsApi } from '../../api'
import { useAuthStore } from '../../stores'
import { Button, Modal, Input, Textarea, Avatar, EmptyState, Spinner } from '../common'
import { cn, formatDateTime, formatDate } from '../../utils'
import type { Meeting, MeetingMinutes, ProjectMember } from '../../types'

interface Props {
  projectId: string
  blockId?: string
  members: ProjectMember[]
}

export const MeetingSpace: React.FC<Props> = ({ projectId, blockId, members }) => {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [addModal, setAddModal] = useState(false)
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null)
  const [meetingInProgress, setMeetingInProgress] = useState<Meeting | null>(null)

  useEffect(() => { loadMeetings() }, [projectId])

  async function loadMeetings() {
    setLoading(true)
    try {
      const res = await meetingsApi.list(projectId)
      setMeetings(res.data)
    } catch {} finally { setLoading(false) }
  }

  async function deleteMeeting(id: string) {
    if (!confirm('このミーティングを削除しますか？')) return
    await meetingsApi.delete(id)
    loadMeetings()
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  if (meetingInProgress) {
    return (
      <MeetingRoom
        meeting={meetingInProgress}
        members={members}
        onLeave={() => setMeetingInProgress(null)}
      />
    )
  }

  const now = new Date()
  const upcoming = meetings.filter(m => new Date(m.scheduled_at) >= now && m.status !== 'cancelled')
  const past = meetings.filter(m => new Date(m.scheduled_at) < now || m.status === 'completed')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-[#888]">ミーティング</h4>
        <Button size="sm" onClick={() => setAddModal(true)}>+ ミーティングを追加</Button>
      </div>

      {meetings.length === 0 ? (
        <EmptyState icon="📹" title="ミーティングがありません"
          action={<Button size="sm" onClick={() => setAddModal(true)}>ミーティングを追加</Button>} />
      ) : (
        <div className="space-y-5">
          {upcoming.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#999] mb-2">予定</p>
              <div className="space-y-2">
                {upcoming.map((m) => (
                  <MeetingCard key={m.id} meeting={m} members={members}
                    onStart={() => setMeetingInProgress(m)}
                    onSelect={() => setActiveMeeting(m)}
                    onDelete={() => deleteMeeting(m.id)} />
                ))}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#999] mb-2">過去</p>
              <div className="space-y-2">
                {past.map((m) => (
                  <MeetingCard key={m.id} meeting={m} members={members}
                    onSelect={() => setActiveMeeting(m)}
                    onDelete={() => deleteMeeting(m.id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <MeetingFormModal
        open={addModal} onClose={() => setAddModal(false)}
        projectId={projectId} blockId={blockId}
        members={members} onSaved={() => { setAddModal(false); loadMeetings() }}
      />

      {activeMeeting && (
        <MeetingDetailModal
          meeting={activeMeeting}
          onClose={() => setActiveMeeting(null)}
          onStart={() => { setActiveMeeting(null); setMeetingInProgress(activeMeeting) }}
        />
      )}
    </div>
  )
}

const MeetingCard: React.FC<{
  meeting: Meeting; members: ProjectMember[]
  onStart?: () => void; onSelect: () => void; onDelete: () => void
}> = ({ meeting, onStart, onSelect, onDelete }) => {
  const isPast = new Date(meeting.scheduled_at) < new Date()
  return (
    <div className="flex items-center gap-3 bg-white border border-silver rounded-xl px-4 py-3 hover:shadow-card transition-shadow">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0',
        isPast ? 'bg-snow' : 'bg-violet/10')}>
        {isPast ? '📋' : '📹'}
      </div>
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onSelect}>
        <p className="font-medium text-sm truncate">{meeting.title}</p>
        <p className="text-xs text-[#999]">{formatDateTime(meeting.scheduled_at)} · {meeting.duration_minutes}分</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {!isPast && onStart && <Button size="sm" onClick={onStart}>開始</Button>}
        <Button size="sm" variant="ghost" onClick={onSelect}>詳細</Button>
        <button onClick={onDelete} className="text-[#ccc] hover:text-red-400 transition-colors text-sm">🗑️</button>
      </div>
    </div>
  )
}

const MeetingFormModal: React.FC<{
  open: boolean; onClose: () => void; projectId: string; blockId?: string
  members: ProjectMember[]; onSaved: () => void
}> = ({ open, onClose, projectId, blockId, members, onSaved }) => {
  const [form, setForm] = useState({ title: '', description: '', scheduled_at: '', duration_minutes: 60, attendee_ids: [] as string[] })
  const [loading, setLoading] = useState(false)
  useEffect(() => { if (!open) setForm({ title: '', description: '', scheduled_at: '', duration_minutes: 60, attendee_ids: [] }) }, [open])

  async function submit() {
    if (!form.title || !form.scheduled_at) return
    setLoading(true)
    try { await meetingsApi.create({ ...form, project_id: projectId, block_id: blockId }); onSaved() }
    catch {} finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="ミーティングを追加" size="md">
      <div className="space-y-3">
        <Input label="タイトル *" placeholder="ミーティング名" value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <Textarea label="概要" placeholder="議題・目的など" rows={2} value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="日時 *" type="datetime-local" value={form.scheduled_at}
            onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
          <Input label="時間（分）" type="number" min={15} step={15} value={form.duration_minutes}
            onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} />
        </div>
        <div>
          <label className="text-xs font-medium text-[#666] block mb-1.5">参加者</label>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => {
              const selected = form.attendee_ids.includes(m.id)
              return (
                <button key={m.id} type="button"
                  onClick={() => setForm({ ...form, attendee_ids: selected ? form.attendee_ids.filter(id => id !== m.id) : [...form.attendee_ids, m.id] })}
                  className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                    selected ? 'bg-violet/10 border-violet text-violet' : 'bg-snow border-silver text-[#666]')}>
                  <Avatar name={m.username} size="xs" />{m.username}
                </button>
              )
            })}
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="ghost" onClick={onClose}>キャンセル</Button>
        <Button loading={loading} onClick={submit}>追加</Button>
      </div>
    </Modal>
  )
}

const MeetingDetailModal: React.FC<{ meeting: Meeting; onClose: () => void; onStart: () => void }> = ({
  meeting, onClose, onStart
}) => {
  const [minutes, setMinutes] = useState<MeetingMinutes[]>([])
  const [addMinutes, setAddMinutes] = useState(false)
  const [editMin, setEditMin] = useState<MeetingMinutes | null>(null)
  const [form, setForm] = useState({ title: '', content: '' })

  useEffect(() => { loadMinutes() }, [meeting.id])

  async function loadMinutes() {
    try { const r = await meetingsApi.getMinutes(meeting.id); setMinutes(r.data) } catch {}
  }

  async function save() {
    if (!form.title) return
    if (editMin) await meetingsApi.updateMinutes(meeting.id, editMin.id, form)
    else await meetingsApi.createMinutes(meeting.id, form)
    setForm({ title: '', content: '' }); setAddMinutes(false); setEditMin(null); loadMinutes()
  }

  const isPast = new Date(meeting.scheduled_at) < new Date()

  return (
    <Modal open onClose={onClose} title={meeting.title} size="lg">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 text-sm text-[#666]">
          <span>📅 {formatDateTime(meeting.scheduled_at)}</span>
          <span>⏱ {meeting.duration_minutes}分</span>
        </div>
        {meeting.description && <p className="text-sm bg-snow rounded-xl p-3 text-[#444]">{meeting.description}</p>}
        {!isPast && <Button onClick={onStart} className="w-full">🎥 ミーティングを開始</Button>}

        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-sm">議事録 ({minutes.length})</h4>
            <Button size="sm" variant="ghost" onClick={() => { setAddMinutes(true); setEditMin(null); setForm({ title: '', content: '' }) }}>+ 追加</Button>
          </div>
          <div className="space-y-2 mb-3">
            {minutes.map((m) => (
              <div key={m.id} className="bg-snow rounded-xl p-3 cursor-pointer hover:bg-silver/40 transition-colors"
                onClick={() => { setEditMin(m); setForm({ title: m.title, content: m.content }); setAddMinutes(true) }}>
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{m.title}</p>
                  <span className="text-xs text-[#bbb]">{formatDate(m.created_at)}</span>
                </div>
                <p className="text-xs text-[#999] mt-0.5">{m.created_by_name}</p>
                {m.content && <p className="text-sm mt-1.5 text-[#555] line-clamp-2">{m.content}</p>}
              </div>
            ))}
          </div>
          {addMinutes && (
            <div className="space-y-2 p-3 bg-snow rounded-xl border border-silver">
              <Input placeholder="タイトル *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <Textarea placeholder="内容" rows={5} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
              <div className="flex gap-2">
                <Button size="sm" onClick={save}>保存</Button>
                <Button size="sm" variant="ghost" onClick={() => { setAddMinutes(false); setEditMin(null) }}>キャンセル</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

declare global { interface Window { JitsiMeetExternalAPI: any } }

const MeetingRoom: React.FC<{ meeting: Meeting; members: ProjectMember[]; onLeave: () => void }> = ({
  meeting, members, onLeave
}) => {
  const { user } = useAuthStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<any>(null)

  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://meet.jit.si/external_api.js'
    script.async = true
    script.onload = init
    document.head.appendChild(script)
    return () => { apiRef.current?.dispose(); try { document.head.removeChild(script) } catch {} }
  }, [])

  function init() {
    if (!containerRef.current || !window.JitsiMeetExternalAPI) return
    apiRef.current = new window.JitsiMeetExternalAPI('meet.jit.si', {
      roomName: meeting.jitsi_room_id,
      parentNode: containerRef.current,
      configOverwrite: { startWithAudioMuted: true, disableDeepLinking: true, prejoinPageEnabled: false },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        TOOLBAR_BUTTONS: ['microphone','camera','desktop','fullscreen','fodeviceselection','hangup','chat','settings','tileview'],
      },
      userInfo: { displayName: user?.username || 'Guest', email: user?.email || '' },
    })
    apiRef.current.addEventListener('videoConferenceLeft', onLeave)
    apiRef.current.addEventListener('readyToClose', onLeave)
  }

  return (
    <div className="flex gap-4 h-[640px]">
      <div className="flex-[3] flex flex-col gap-2 min-w-0">
        <div className="flex items-center justify-between px-1">
          <div>
            <h3 className="font-semibold text-sm">{meeting.title}</h3>
            <p className="text-xs text-[#999]">🔴 会議中 · Jitsi Meet</p>
          </div>
          <Button size="sm" variant="danger" onClick={onLeave}>退出</Button>
        </div>
        <div ref={containerRef} className="flex-1 rounded-2xl overflow-hidden bg-ink" />
      </div>
      <div className="flex-[2] bg-white border border-silver rounded-2xl overflow-y-auto p-4 space-y-4">
        <div>
          <h4 className="font-semibold text-sm mb-3">参加者 ({members.length})</h4>
          <div className="space-y-2.5">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-2.5 text-sm">
                <Avatar name={m.username} src={m.avatar_url} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{m.username}</p>
                  <p className="text-xs text-[#999]">{m.job_type}</p>
                </div>
                {m.status_emoji && <span>{m.status_emoji}</span>}
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-silver pt-3">
          <h4 className="font-semibold text-sm mb-2">会議情報</h4>
          <div className="space-y-1 text-xs text-[#777]">
            <p>📅 {formatDateTime(meeting.scheduled_at)}</p>
            <p>⏱ {meeting.duration_minutes}分</p>
            <p className="font-mono text-[10px] bg-snow rounded px-2 py-1 break-all mt-2">
              Room: {meeting.jitsi_room_id}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
