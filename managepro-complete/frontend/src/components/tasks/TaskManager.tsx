import React, { useState, useEffect, useCallback } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { tasksApi } from '../../api'
import { Button, Input, Textarea, Select, Modal, Avatar, Badge, EmptyState, Tabs, Spinner } from '../common'
import { cn, PRIORITY_LABELS, PRIORITY_COLORS, STATUS_LABELS, STATUS_COLORS, formatDate } from '../../utils'
import type { Task, TaskStatus, TaskPriority, ProjectMember } from '../../types'

const KANBAN_COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: 'todo', label: '未着手' },
  { key: 'in_progress', label: '進行中' },
  { key: 'review', label: 'レビュー' },
  { key: 'done', label: '完了' },
]

interface Props {
  projectId: string
  blockId?: string
  members: ProjectMember[]
  readOnly?: boolean
}

export const TaskManager: React.FC<Props> = ({ projectId, blockId, members, readOnly }) => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [view, setView] = useState<'list' | 'kanban'>('list')
  const [loading, setLoading] = useState(true)
  const [addModal, setAddModal] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [detailTask, setDetailTask] = useState<Task | null>(null)

  useEffect(() => { loadTasks() }, [projectId, blockId])

  async function loadTasks() {
    setLoading(true)
    try {
      const res = await tasksApi.list(projectId, blockId)
      setTasks(res.data)
    } catch {} finally { setLoading(false) }
  }

  async function onDragEnd(result: DropResult) {
    if (!result.destination) return
    const { draggableId, destination } = result
    const newStatus = destination.droppableId as TaskStatus
    const newPos = destination.index

    setTasks((prev) =>
      prev.map((t) => t.id === draggableId ? { ...t, status: newStatus, position: newPos } : t)
    )

    await tasksApi.updateStatus(draggableId, { status: newStatus, position: newPos })
  }

  if (loading) return (
    <div className="flex items-center justify-center h-32"><Spinner /></div>
  )

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <Tabs
          tabs={[{ key: 'list', label: 'リスト', icon: '☰' }, { key: 'kanban', label: 'カンバン', icon: '⬛' }]}
          active={view}
          onChange={(v) => setView(v as 'list' | 'kanban')}
        />
        {!readOnly && (
          <Button size="sm" onClick={() => setAddModal(true)}>+ タスクを追加</Button>
        )}
      </div>

      {/* Views */}
      {tasks.length === 0 ? (
        <EmptyState icon="✅" title="タスクがありません" description="タスクを追加して管理を始めましょう"
          action={!readOnly ? <Button size="sm" onClick={() => setAddModal(true)}>最初のタスクを追加</Button> : undefined} />
      ) : view === 'list' ? (
        <ListView tasks={tasks} members={members} onEdit={setEditTask} onDetail={setDetailTask} readOnly={readOnly} />
      ) : (
        <KanbanView tasks={tasks} members={members} onDragEnd={onDragEnd} onEdit={setEditTask} onDetail={setDetailTask} readOnly={readOnly} />
      )}

      {/* Add/Edit Modal */}
      <TaskFormModal
        open={addModal || !!editTask}
        onClose={() => { setAddModal(false); setEditTask(null) }}
        projectId={projectId}
        blockId={blockId}
        members={members}
        task={editTask}
        onSaved={loadTasks}
      />

      {/* Detail Drawer */}
      {detailTask && (
        <TaskDetailDrawer
          task={detailTask}
          members={members}
          onClose={() => setDetailTask(null)}
          onEdit={(t) => { setDetailTask(null); setEditTask(t) }}
          onDelete={async (id) => { await tasksApi.delete(id); setDetailTask(null); loadTasks() }}
          onRefresh={loadTasks}
        />
      )}
    </div>
  )
}

// ─── List View ────────────────────────────────────────────────────────────

const ListView: React.FC<{
  tasks: Task[]; members: ProjectMember[];
  onEdit: (t: Task) => void; onDetail: (t: Task) => void; readOnly?: boolean
}> = ({ tasks, onEdit, onDetail }) => (
  <div className="bg-white border border-silver rounded-xl overflow-hidden">
    <div className="grid grid-cols-[1fr_auto_auto_auto_auto] text-[11px] font-semibold uppercase tracking-wider text-[#999] px-4 py-2.5 border-b border-silver">
      <span>タスク名</span>
      <span className="w-20 text-center">担当者</span>
      <span className="w-20 text-center">優先度</span>
      <span className="w-24 text-center">ステータス</span>
      <span className="w-20 text-center">終了日</span>
    </div>
    <div className="divide-y divide-silver/60">
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} onClick={() => onDetail(task)} />
      ))}
    </div>
  </div>
)

const TaskRow: React.FC<{ task: Task; onClick: () => void }> = ({ task, onClick }) => {
  const sc = STATUS_COLORS[task.status]
  const pc = PRIORITY_COLORS[task.priority]
  return (
    <div
      className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center px-4 py-3 hover:bg-snow cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div>
        <span className={cn('text-sm', task.status === 'done' && 'line-through text-[#999]')}>{task.title}</span>
        {task.subtask_count ? (
          <span className="ml-2 text-xs text-[#bbb]">└ {task.subtask_count}</span>
        ) : null}
      </div>
      <div className="w-20 flex justify-center">
        {task.assignee_name
          ? <Avatar name={task.assignee_name} src={task.assignee_avatar} size="xs" />
          : <span className="text-[#ccc] text-sm">—</span>
        }
      </div>
      <div className="w-20 flex justify-center">
        <span className="text-xs font-semibold" style={{ color: pc }}>{PRIORITY_LABELS[task.priority]}</span>
      </div>
      <div className="w-24 flex justify-center">
        <Badge bg={sc.bg} color={sc.text}>{STATUS_LABELS[task.status]}</Badge>
      </div>
      <div className="w-20 text-center text-xs text-[#888]">{formatDate(task.due_date)}</div>
    </div>
  )
}

// ─── Kanban View ─────────────────────────────────────────────────────────

const KanbanView: React.FC<{
  tasks: Task[]; members: ProjectMember[];
  onDragEnd: (r: DropResult) => void;
  onEdit: (t: Task) => void; onDetail: (t: Task) => void; readOnly?: boolean
}> = ({ tasks, onDragEnd, onDetail }) => {
  const byStatus = (status: TaskStatus) => tasks.filter((t) => t.status === status)

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {KANBAN_COLUMNS.map((col) => {
          const colTasks = byStatus(col.key)
          return (
            <div key={col.key} className={cn('flex-shrink-0 w-64 bg-snow rounded-xl p-3 kanban-' + col.key)}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#888]">{col.label}</h4>
                <span className="bg-silver text-[#666] text-xs font-medium rounded-full w-5 h-5 flex items-center justify-center">
                  {colTasks.length}
                </span>
              </div>
              <Droppable droppableId={col.key}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn('min-h-[80px] space-y-2 rounded-lg transition-colors', snapshot.isDraggingOver && 'bg-violet/5')}
                  >
                    {colTasks.map((task, i) => (
                      <Draggable key={task.id} draggableId={task.id} index={i}>
                        {(prov, snap) => (
                          <div
                            ref={prov.innerRef}
                            {...prov.draggableProps}
                            {...prov.dragHandleProps}
                            onClick={() => onDetail(task)}
                            className={cn(
                              'bg-white rounded-xl p-3 shadow-card cursor-pointer hover:shadow-card-hover transition-shadow',
                              snap.isDragging && 'shadow-modal rotate-1'
                            )}
                          >
                            <p className="text-sm font-medium leading-snug mb-2">{task.title}</p>
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold" style={{ color: PRIORITY_COLORS[task.priority] }}>
                                {PRIORITY_LABELS[task.priority]}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {task.due_date && (
                                  <span className="text-[11px] text-[#999]">{formatDate(task.due_date)}</span>
                                )}
                                {task.assignee_name && (
                                  <Avatar name={task.assignee_name} src={task.assignee_avatar} size="xs" />
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          )
        })}
      </div>
    </DragDropContext>
  )
}

// ─── Task Form Modal ──────────────────────────────────────────────────────

const TaskFormModal: React.FC<{
  open: boolean; onClose: () => void;
  projectId: string; blockId?: string;
  members: ProjectMember[]; task?: Task | null;
  onSaved: () => void; parentTaskId?: string
}> = ({ open, onClose, projectId, blockId, members, task, onSaved, parentTaskId }) => {
  const [form, setForm] = useState({
    title: '', description: '', priority: 'medium' as TaskPriority,
    status: 'todo' as TaskStatus, due_date: '', assignee_id: '', protocol: ''
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title, description: task.description,
        priority: task.priority, status: task.status,
        due_date: task.due_date || '', assignee_id: task.assignee_id || '',
        protocol: task.protocol || ''
      })
    } else {
      setForm({ title: '', description: '', priority: 'medium', status: 'todo', due_date: '', assignee_id: '', protocol: '' })
    }
  }, [task, open])

  async function submit() {
    if (!form.title.trim()) return
    setLoading(true)
    try {
      if (task) {
        await tasksApi.update(task.id, { ...form, project_id: projectId })
      } else {
        await tasksApi.create({
          ...form,
          project_id: projectId,
          block_id: blockId,
          parent_task_id: parentTaskId || null,
        })
      }
      onSaved()
      onClose()
    } catch {} finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={task ? 'タスクを編集' : 'タスクを追加'} size="lg">
      <div className="space-y-3">
        <Input label="タスク名 *" placeholder="タスク名を入力" value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <Textarea label="説明 *" placeholder="タスクの詳細" rows={3} value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Select label="優先度 *" value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}>
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
            <option value="urgent">緊急</option>
          </Select>
          <Select label="ステータス *" value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })}>
            <option value="todo">未着手</option>
            <option value="in_progress">進行中</option>
            <option value="review">レビュー</option>
            <option value="done">完了</option>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="終了日 *" type="date" value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          <Select label="担当者 *" value={form.assignee_id}
            onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}>
            <option value="">担当者なし</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.username}</option>)}
          </Select>
        </div>
        <Textarea label="プロトコル（任意）" placeholder="タスクに関する手順や注意事項" rows={2}
          value={form.protocol} onChange={(e) => setForm({ ...form, protocol: e.target.value })} />
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="ghost" onClick={onClose}>キャンセル</Button>
        <Button loading={loading} onClick={submit}>{task ? '保存' : '追加'}</Button>
      </div>
    </Modal>
  )
}

// ─── Task Detail Drawer ───────────────────────────────────────────────────

const TaskDetailDrawer: React.FC<{
  task: Task; members: ProjectMember[];
  onClose: () => void; onEdit: (t: Task) => void;
  onDelete: (id: string) => void; onRefresh: () => void
}> = ({ task, members, onClose, onEdit, onDelete, onRefresh }) => {
  const [detail, setDetail] = useState<Task>(task)
  const [addLink, setAddLink] = useState(false)
  const [linkForm, setLinkForm] = useState({ title: '', url: '' })
  const [addSubtask, setAddSubtask] = useState(false)
  const [showProtocol, setShowProtocol] = useState(false)

  useEffect(() => { loadDetail() }, [task.id])

  async function loadDetail() {
    try {
      const res = await tasksApi.get(task.id)
      setDetail(res.data)
    } catch {}
  }

  async function saveLink() {
    if (!linkForm.title || !linkForm.url) return
    await tasksApi.addLink(detail.id, linkForm)
    setLinkForm({ title: '', url: '' })
    setAddLink(false)
    loadDetail()
  }

  async function deleteLink(linkId: string) {
    await tasksApi.deleteLink(detail.id, linkId)
    loadDetail()
  }

  const sc = STATUS_COLORS[detail.status]
  const pc = PRIORITY_COLORS[detail.priority]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end animate-fade-in">
      <div className="absolute inset-0 bg-ink/20" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg h-full shadow-modal flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-silver">
          <div className="flex-1 pr-4">
            <h3 className="font-semibold text-base leading-snug">{detail.title}</h3>
            <div className="flex items-center gap-2 mt-2">
              <Badge bg={sc.bg} color={sc.text}>{STATUS_LABELS[detail.status]}</Badge>
              <span className="text-xs font-semibold" style={{ color: pc }}>{PRIORITY_LABELS[detail.priority]}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => onEdit(detail)}>✏️</Button>
            <Button size="sm" variant="ghost" className="text-red-500" onClick={() => onDelete(detail.id)}>🗑️</Button>
            <Button size="sm" variant="ghost" onClick={onClose}>✕</Button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-[#999] mb-1">担当者</p>
              {detail.assignee_name
                ? <div className="flex items-center gap-2"><Avatar name={detail.assignee_name} size="xs" />{detail.assignee_name}</div>
                : <span className="text-[#ccc]">未設定</span>
              }
            </div>
            <div>
              <p className="text-xs text-[#999] mb-1">終了日</p>
              <p className={cn(detail.due_date && new Date(detail.due_date) < new Date() && detail.status !== 'done' && 'text-red-500')}>
                {formatDate(detail.due_date) || '—'}
              </p>
            </div>
          </div>

          {/* Description */}
          {detail.description && (
            <div>
              <p className="text-xs font-semibold text-[#999] uppercase tracking-wider mb-1.5">説明</p>
              <p className="text-sm text-[#444] whitespace-pre-wrap">{detail.description}</p>
            </div>
          )}

          {/* Protocol */}
          {detail.protocol && (
            <div>
              <button
                className="flex items-center gap-1.5 text-xs font-semibold text-[#999] uppercase tracking-wider mb-1.5"
                onClick={() => setShowProtocol(!showProtocol)}
              >
                <span>{showProtocol ? '▼' : '▶'}</span> プロトコル
              </button>
              {showProtocol && (
                <div className="bg-snow rounded-xl p-3">
                  <p className="text-sm whitespace-pre-wrap">{detail.protocol}</p>
                </div>
              )}
            </div>
          )}

          {/* Subtasks */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-[#999] uppercase tracking-wider">サブタスク ({detail.subtasks?.length || 0})</p>
              <Button size="sm" variant="ghost" onClick={() => setAddSubtask(true)}>+ 追加</Button>
            </div>
            <div className="space-y-1.5">
              {detail.subtasks?.map((st) => (
                <div key={st.id} className="flex items-center gap-2.5 px-3 py-2 bg-snow rounded-lg text-sm">
                  <span>{st.status === 'done' ? '✅' : '⬜'}</span>
                  <span className={cn(st.status === 'done' && 'line-through text-[#999]')}>{st.title}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Links */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-[#999] uppercase tracking-wider">関連資料 ({detail.links?.length || 0})</p>
              <Button size="sm" variant="ghost" onClick={() => setAddLink(true)}>+ 追加</Button>
            </div>
            <div className="space-y-1.5">
              {detail.links?.map((link) => (
                <div key={link.id} className="flex items-center gap-2 px-3 py-2 bg-snow rounded-lg group">
                  <a href={link.url} target="_blank" rel="noopener noreferrer"
                    className="flex-1 text-sm text-violet hover:underline flex items-center gap-1.5 min-w-0">
                    <span>🔗</span><span className="truncate">{link.title}</span>
                  </a>
                  <button onClick={() => deleteLink(link.id)}
                    className="opacity-0 group-hover:opacity-100 text-[#ccc] hover:text-red-400 text-xs">✕</button>
                </div>
              ))}
            </div>

            {addLink && (
              <div className="mt-2 p-3 bg-snow rounded-xl space-y-2">
                <Input placeholder="リンクタイトル" value={linkForm.title}
                  onChange={(e) => setLinkForm({ ...linkForm, title: e.target.value })} />
                <Input placeholder="https://..." value={linkForm.url}
                  onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveLink}>追加</Button>
                  <Button size="sm" variant="ghost" onClick={() => setAddLink(false)}>キャンセル</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Subtask add modal */}
      {addSubtask && (
        <TaskFormModal
          open={addSubtask} onClose={() => setAddSubtask(false)}
          projectId={detail.project_id} members={members}
          parentTaskId={detail.id}
          onSaved={() => { setAddSubtask(false); loadDetail() }}
        />
      )}
    </div>
  )
}

export { TaskFormModal }
