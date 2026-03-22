import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import jaLocale from '@fullcalendar/core/locales/ja.js'
import { usersApi, projectsApi } from '../api'
import { useAuthStore, useOrgStore } from '../stores'
import { Header } from '../components/layout/Header'
import { Button, Card, Avatar, AvatarGroup, Badge, Modal, Input, Spinner, Tabs, EmptyState } from '../components/common'
import { cn, STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS, formatDate, formatDateTime } from '../utils'
import type { Task, CalendarEvent, Project } from '../types'

export const TopPage: React.FC = () => {
  const { user } = useAuthStore()
  const { activeOrgId } = useOrgStore()
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [taskView, setTaskView] = useState<'list' | 'kanban'>('list')
  const [loading, setLoading] = useState(true)
  const [addEventModal, setAddEventModal] = useState(false)
  const [newEvent, setNewEvent] = useState({ title: '', start_at: '', end_at: '', all_day: true, description: '' })
  const [addProjectModal, setAddProjectModal] = useState(false)

  useEffect(() => { loadAll() }, [activeOrgId])

  async function loadAll() {
    setLoading(true)
    try {
      const [tasksRes, projectsRes] = await Promise.all([
        usersApi.getTasks(),
        projectsApi.list(activeOrgId || undefined),
      ])
      setTasks(tasksRes.data)
      setProjects(projectsRes.data)
    } catch {} finally { setLoading(false) }
  }

  async function loadCalendarEvents(start: string, end: string) {
    try {
      const res = await usersApi.getCalendar(start, end)
      setEvents(res.data)
    } catch {}
  }

  async function addEvent() {
    if (!newEvent.title || !newEvent.start_at) return
    await usersApi.addCalendarEvent(newEvent)
    setAddEventModal(false)
    setNewEvent({ title: '', start_at: '', end_at: '', all_day: true, description: '' })
  }

  const calendarEvents = events.map((e) => ({
    id: e.id,
    title: e.title,
    start: e.start_at,
    end: e.end_at || undefined,
    allDay: !!e.all_day,
    backgroundColor: e.color,
    borderColor: e.color,
    extendedProps: { source_type: e.source_type },
  }))

  const todoTasks = tasks.filter((t) => t.status !== 'done')
  const doneTasks = tasks.filter((t) => t.status === 'done')

  return (
    <div className="min-h-screen bg-snow">
      <Header />
      <main className="pt-14 max-w-6xl mx-auto px-4 pb-24">
        {/* ── Welcome ── */}
        <div className="py-8">
          <h1 className="text-2xl font-bold tracking-tight">
            おはようございます、{user?.username}さん 👋
          </h1>
          <p className="text-[#999] text-sm mt-1">
            {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
          {/* Left column */}
          <div className="space-y-6">
            {/* ── My Tasks ── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-base">マイタスク</h2>
                <Tabs
                  tabs={[{ key: 'list', label: 'リスト', icon: '☰' }, { key: 'kanban', label: 'カンバン', icon: '⬛' }]}
                  active={taskView}
                  onChange={(v) => setTaskView(v as 'list' | 'kanban')}
                />
              </div>

              {loading ? <div className="flex justify-center py-8"><Spinner /></div>
                : todoTasks.length === 0 ? (
                  <EmptyState icon="🎉" title="すべてのタスクが完了しています！" />
                ) : taskView === 'list' ? (
                  <div className="bg-white border border-silver rounded-2xl overflow-hidden">
                    <div className="divide-y divide-silver/60">
                      {todoTasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-snow cursor-pointer transition-colors"
                          onClick={() => navigate(`/projects/${task.project_id}`)}
                        >
                          <span className="text-sm w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: task.project_color || '#9664F7' }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{task.title}</p>
                            <p className="text-xs text-[#bbb]">{task.project_name}</p>
                          </div>
                          <span className="text-xs font-semibold flex-shrink-0" style={{ color: PRIORITY_COLORS[task.priority] }}>
                            {PRIORITY_LABELS[task.priority]}
                          </span>
                          <span className="text-xs text-[#999] flex-shrink-0 w-16 text-right">
                            {formatDate(task.due_date)}
                          </span>
                          <Badge bg={STATUS_COLORS[task.status].bg} color={STATUS_COLORS[task.status].text}>
                            {STATUS_LABELS[task.status]}
                          </Badge>
                        </div>
                      ))}
                    </div>
                    {doneTasks.length > 0 && (
                      <div className="px-4 py-2 border-t border-silver bg-snow">
                        <p className="text-xs text-[#bbb]">完了済み: {doneTasks.length}件</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {(['todo', 'in_progress', 'review'] as const).map((status) => {
                      const colTasks = todoTasks.filter((t) => t.status === status)
                      return (
                        <div key={status} className={cn('flex-shrink-0 w-56 bg-snow rounded-xl p-3 kanban-' + status)}>
                          <p className="text-xs font-semibold uppercase tracking-wider text-[#888] mb-2">
                            {STATUS_LABELS[status]} ({colTasks.length})
                          </p>
                          <div className="space-y-2">
                            {colTasks.map((task) => (
                              <div key={task.id}
                                className="bg-white rounded-xl p-3 shadow-card cursor-pointer hover:shadow-card-hover transition-shadow"
                                onClick={() => navigate(`/projects/${task.project_id}`)}>
                                <p className="text-sm font-medium mb-1">{task.title}</p>
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px]" style={{ color: task.project_color }}>{task.project_name}</span>
                                  <span className="text-[10px] text-[#999]">{formatDate(task.due_date)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              }
            </section>

            {/* ── Calendar ── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-base">カレンダー</h2>
                <Button size="sm" variant="ghost" onClick={() => setAddEventModal(true)}>+ 予定を追加</Button>
              </div>
              <div className="bg-white border border-silver rounded-2xl p-4 overflow-hidden">
                <FullCalendar
                  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                  initialView="dayGridMonth"
                  locale={jaLocale}
                  headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek' }}
                  events={calendarEvents}
                  height={400}
                  datesSet={(info: any) => loadCalendarEvents(info.startStr, info.endStr)}
                  eventClick={(info: any) => {
                    const src = info.event.extendedProps.source_type
                    if (src === 'custom') {
                      if (confirm('このイベントを削除しますか？')) {
                        usersApi.deleteCalendarEvent(info.event.id).then(() => {
                          setEvents((prev) => prev.filter((e) => e.id !== info.event.id))
                        })
                      }
                    }
                  }}
                  dateClick={(info: any) => {
                    setNewEvent({ ...newEvent, start_at: info.dateStr, all_day: true })
                    setAddEventModal(true)
                  }}
                />
              </div>
            </section>
          </div>

          {/* Right column – Projects */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-base">プロジェクト</h2>
              <Button size="sm" onClick={() => setAddProjectModal(true)}>+ 追加</Button>
            </div>

            {loading ? <Spinner /> : projects.length === 0 ? (
              <EmptyState icon="🚀" title="プロジェクトがありません"
                action={<Button size="sm" onClick={() => setAddProjectModal(true)}>プロジェクトを追加</Button>} />
            ) : (
              <div className="space-y-3">
                {projects.map((p) => (
                  <Card key={p.id} onClick={() => navigate(`/projects/${p.id}`)} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: p.color }}>
                        {p.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{p.name}</p>
                        {p.description && (
                          <p className="text-xs text-[#999] mt-0.5 line-clamp-2">{p.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          {p.next_meeting && (
                            <span className="text-[10px] text-[#bbb]">
                              📹 {formatDateTime(p.next_meeting)}
                            </span>
                          )}
                          {p.nearest_task && (
                            <span className="text-[10px] text-[#bbb] truncate max-w-[100px]">
                              ✅ {p.nearest_task}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <AvatarGroup members={[]} max={3} />
                          {p.open_tasks !== undefined && (
                            <span className="text-[10px] text-[#bbb]">{p.open_tasks}件のタスク</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Add Event Modal */}
      <Modal open={addEventModal} onClose={() => setAddEventModal(false)} title="予定を追加">
        <div className="space-y-3">
          <Input label="タイトル *" value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="開始" type={newEvent.all_day ? 'date' : 'datetime-local'} value={newEvent.start_at}
              onChange={(e) => setNewEvent({ ...newEvent, start_at: e.target.value })} />
            <Input label="終了" type={newEvent.all_day ? 'date' : 'datetime-local'} value={newEvent.end_at}
              onChange={(e) => setNewEvent({ ...newEvent, end_at: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={newEvent.all_day} onChange={(e) => setNewEvent({ ...newEvent, all_day: e.target.checked })} />
            終日
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={() => setAddEventModal(false)}>キャンセル</Button>
          <Button onClick={addEvent}>追加</Button>
        </div>
      </Modal>

      {/* Add Project Modal */}
      {addProjectModal && (
        <AddProjectModal
          orgId={activeOrgId || ''}
          onClose={() => setAddProjectModal(false)}
          onSaved={() => { setAddProjectModal(false); loadAll() }}
        />
      )}
    </div>
  )
}

// ─── Add Project Modal ────────────────────────────────────────────────────

const AddProjectModal: React.FC<{ orgId: string; onClose: () => void; onSaved: () => void }> = ({
  orgId, onClose, onSaved
}) => {
  const [form, setForm] = useState({ name: '', description: '', color: '#9664F7' })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const COLORS = ['#9664F7', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#F97316']

  async function submit() {
    if (!form.name.trim()) return
    setLoading(true)
    try {
      const res = await projectsApi.create({ ...form, org_id: orgId })
      onSaved()
      navigate(`/projects/${res.data.id}`)
    } catch {} finally { setLoading(false) }
  }

  return (
    <Modal open onClose={onClose} title="プロジェクトを作成">
      <div className="space-y-4">
        <Input label="プロジェクト名 *" placeholder="新しいプロジェクト" value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input label="概要 *" placeholder="このプロジェクトの目的" value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div>
          <label className="text-xs font-medium text-[#666] block mb-2">カラー</label>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button key={c} onClick={() => setForm({ ...form, color: c })}
                className={cn('w-8 h-8 rounded-full transition-transform', form.color === c && 'scale-125 ring-2 ring-offset-2 ring-ink')}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="ghost" onClick={onClose}>キャンセル</Button>
        <Button loading={loading} onClick={submit}>作成</Button>
      </div>
    </Modal>
  )
}
