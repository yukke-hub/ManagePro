import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { projectsApi } from '../api'
import { Header } from '../components/layout/Header'
import { TaskManager } from '../components/tasks/TaskManager'
import { ChatSpace } from '../components/chat/ChatSpace'
import { MeetingSpace } from '../components/meeting/MeetingSpace'
import { BudgetTool, WhiteboardTool, ResourceEmbed } from '../components/resources/Tools'
import { Button, Avatar, AvatarGroup, Badge, Modal, Input, Spinner, EmptyState, Card } from '../components/common'
import { cn, BLOCK_TYPE_LABELS, BLOCK_TYPE_ICONS } from '../utils'
import type { Project, ProjectBlock, BlockType, ProjectMember } from '../types'

const BLOCK_OPTIONS: { type: BlockType; label: string; icon: string; desc: string }[] = [
  { type: 'task_manager', label: 'タスク管理', icon: '✅', desc: 'リスト・カンバンでタスクを管理' },
  { type: 'chat_space', label: 'チャット', icon: '💬', desc: 'スレッドベースのチャット' },
  { type: 'meeting_space', label: 'ミーティング', icon: '📹', desc: 'ビデオ会議・議事録' },
  { type: 'budget_tool', label: '予算管理', icon: '💰', desc: 'プロジェクト予算の追跡' },
  { type: 'whiteboard', label: 'ホワイトボード', icon: '🎨', desc: 'Figjamライクなホワイトボード' },
  { type: 'resource_embed', label: '資料', icon: '📎', desc: '関連資料のリンクと埋め込み' },
]

export const ProjectPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [blocks, setBlocks] = useState<ProjectBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [addBlockModal, setAddBlockModal] = useState(false)
  const [collapsedBlocks, setCollapsedBlocks] = useState<Set<string>>(new Set())

  useEffect(() => { if (id) loadProject(id) }, [id])

  async function loadProject(projectId: string) {
    setLoading(true)
    try {
      const res = await projectsApi.get(projectId)
      setProject(res.data)
      setMembers(res.data.members || [])
      setBlocks((res.data.blocks || []).sort((a: ProjectBlock, b: ProjectBlock) => a.position - b.position))
    } catch { navigate('/') } finally { setLoading(false) }
  }

  async function addBlock(type: BlockType) {
    if (!id) return
    const res = await projectsApi.createBlock(id, { block_type: type, position: blocks.length })
    setBlocks((prev) => [...prev, res.data])
    setAddBlockModal(false)
  }

  async function deleteBlock(blockId: string) {
    if (!id || !confirm('このブロックを削除しますか？')) return
    await projectsApi.deleteBlock(id, blockId)
    setBlocks((prev) => prev.filter((b) => b.id !== blockId))
  }

  function toggleCollapse(blockId: string) {
    setCollapsedBlocks((prev) => {
      const next = new Set(prev)
      next.has(blockId) ? next.delete(blockId) : next.add(blockId)
      return next
    })
  }

  if (loading) return (
    <div className="h-screen bg-snow flex items-center justify-center">
      <Spinner size={32} />
    </div>
  )

  if (!project) return null

  return (
    <div className="min-h-screen bg-snow">
      <Header />
      <main className="pt-14 max-w-5xl mx-auto px-4 pb-24">
        {/* ── Project Header ── */}
        <div className="py-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: project.color }} />
                <span className="text-xs font-semibold text-[#999] uppercase tracking-wider">
                  {project.status === 'active' ? '進行中' : project.status === 'completed' ? '完了' : 'アーカイブ'}
                </span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight mb-3">{project.name}</h1>
              {project.description && (
                <p className="text-[#666] text-base leading-relaxed max-w-2xl">{project.description}</p>
              )}
            </div>
            <Button variant="secondary" size="sm" onClick={() => navigate(`/projects/${id}/settings`)}>
              ⚙️ 設定
            </Button>
          </div>

          {/* Members row */}
          <div className="flex items-center gap-3 mt-5">
            <AvatarGroup members={members} max={6} />
            <span className="text-xs text-[#999]">{members.length}人のメンバー</span>
          </div>
        </div>

        {/* ── Blocks ── */}
        <div className="space-y-4">
          {blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24">
              <p className="text-5xl mb-4">🧩</p>
              <h3 className="font-semibold text-lg mb-2">ページを構築しましょう</h3>
              <p className="text-[#999] text-sm mb-6">ツールを追加してプロジェクトページをカスタマイズします</p>
              <Button onClick={() => setAddBlockModal(true)}>+ ツールを追加</Button>
            </div>
          ) : (
            blocks.map((block) => (
              <BlockContainer
                key={block.id}
                block={block}
                project={project}
                members={members}
                collapsed={collapsedBlocks.has(block.id)}
                onToggle={() => toggleCollapse(block.id)}
                onDelete={() => deleteBlock(block.id)}
              />
            ))
          )}

          {blocks.length > 0 && (
            <button
              onClick={() => setAddBlockModal(true)}
              className="w-full py-3 border-2 border-dashed border-silver rounded-2xl text-sm text-[#999] hover:border-violet hover:text-violet transition-colors flex items-center justify-center gap-2"
            >
              <span className="text-lg">+</span> ツールを追加
            </button>
          )}
        </div>
      </main>

      {/* ── Add Block Modal ── */}
      <Modal open={addBlockModal} onClose={() => setAddBlockModal(false)} title="ツールを追加" size="lg">
        <div className="grid grid-cols-2 gap-3">
          {BLOCK_OPTIONS.map((opt) => (
            <button
              key={opt.type}
              onClick={() => addBlock(opt.type)}
              className="flex items-start gap-3 p-4 rounded-xl border-2 border-silver hover:border-violet hover:bg-violet/5 transition-all text-left group"
            >
              <span className="text-2xl">{opt.icon}</span>
              <div>
                <p className="font-semibold text-sm group-hover:text-violet transition-colors">{opt.label}</p>
                <p className="text-xs text-[#999] mt-0.5">{opt.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  )
}

// ─── Block Container ──────────────────────────────────────────────────────

const BlockContainer: React.FC<{
  block: ProjectBlock
  project: Project
  members: ProjectMember[]
  collapsed: boolean
  onToggle: () => void
  onDelete: () => void
}> = ({ block, project, members, collapsed, onToggle, onDelete }) => {
  const icon = BLOCK_TYPE_ICONS[block.block_type]
  const label = block.title || BLOCK_TYPE_LABELS[block.block_type]

  return (
    <div className="bg-white border border-silver rounded-2xl overflow-hidden shadow-card">
      {/* Block header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-silver/60">
        <button onClick={onToggle} className="flex items-center gap-2.5 flex-1 text-left group">
          <span className={cn('text-[#999] text-sm transition-transform', collapsed && '-rotate-90')}>▾</span>
          <span className="text-base">{icon}</span>
          <h3 className="font-semibold text-sm">{label}</h3>
        </button>
        <button
          onClick={onDelete}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#ccc] hover:text-red-400 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 text-sm"
          style={{ /* show on container hover */ }}
        >
          🗑
        </button>
      </div>

      {!collapsed && (
        <div className="p-5">
          {block.block_type === 'task_manager' && (
            <TaskManager projectId={project.id} blockId={block.id} members={members} />
          )}
          {block.block_type === 'chat_space' && (
            <ChatSpace projectId={project.id} blockId={block.id} />
          )}
          {block.block_type === 'meeting_space' && (
            <MeetingSpace projectId={project.id} blockId={block.id} members={members} />
          )}
          {block.block_type === 'budget_tool' && (
            <BudgetTool projectId={project.id} blockId={block.id} />
          )}
          {block.block_type === 'whiteboard' && (
            <WhiteboardTool projectId={project.id} blockId={block.id} />
          )}
          {block.block_type === 'resource_embed' && (
            <ResourceEmbed projectId={project.id} blockId={block.id} />
          )}
        </div>
      )}
    </div>
  )
}
