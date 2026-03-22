// ─────────────────────────────────────────────────────────────────────────
// BudgetTool
// ─────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, lazy, Suspense } from 'react'
import { budgetApi, resourcesApi, whiteboardApi } from '../../api'
import { Button, Input, Select, Modal, EmptyState, Spinner, Badge } from '../common'
import { cn, formatCurrency, formatDate } from '../../utils'
import type { Budget, BudgetItem, Resource } from '../../types'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

// ─── Budget Tool ──────────────────────────────────────────────────────────

export const BudgetTool: React.FC<{ projectId: string; blockId?: string }> = ({ projectId, blockId }) => {
  const [budget, setBudget] = useState<Budget | null>(null)
  const [loading, setLoading] = useState(true)
  const [addModal, setAddModal] = useState(false)
  const [editItem, setEditItem] = useState<BudgetItem | null>(null)

  useEffect(() => { load() }, [projectId, blockId])

  async function load() {
    setLoading(true)
    try {
      const res = await budgetApi.get(projectId, blockId)
      setBudget(res.data)
    } catch {} finally { setLoading(false) }
  }

  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>
  if (!budget) return <EmptyState icon="💰" title="予算が見つかりません" />

  const totalPlanned = budget.items.reduce((s, i) => s + i.planned_amount, 0)
  const totalActual = budget.items.reduce((s, i) => s + i.actual_amount, 0)
  const remaining = budget.total_amount - totalActual
  const pct = budget.total_amount > 0 ? Math.min((totalActual / budget.total_amount) * 100, 100) : 0

  const categories = [...new Set(budget.items.map((i) => i.category))]
  const chartData = categories.map((cat) => {
    const items = budget.items.filter((i) => i.category === cat)
    return {
      name: cat,
      計画: items.reduce((s, i) => s + i.planned_amount, 0),
      実績: items.reduce((s, i) => s + i.actual_amount, 0),
    }
  })

  const statusColors: Record<string, { bg: string; color: string }> = {
    planned: { bg: '#F3F4F6', color: '#6B7280' },
    pending: { bg: '#FEF3C7', color: '#92400E' },
    paid: { bg: '#D1FAE5', color: '#065F46' },
  }
  const statusLabels: Record<string, string> = { planned: '計画中', pending: '承認待ち', paid: '支払済' }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '総予算', value: formatCurrency(budget.total_amount, budget.currency), sub: null },
          { label: '使用額', value: formatCurrency(totalActual, budget.currency), sub: `計画: ${formatCurrency(totalPlanned, budget.currency)}` },
          { label: '残額', value: formatCurrency(remaining, budget.currency), sub: null, warn: remaining < 0 },
        ].map((card) => (
          <div key={card.label} className="bg-white border border-silver rounded-xl p-3">
            <p className="text-xs text-[#999] mb-1">{card.label}</p>
            <p className={cn('text-lg font-bold', card.warn && 'text-red-500')}>{card.value}</p>
            {card.sub && <p className="text-xs text-[#bbb]">{card.sub}</p>}
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between text-xs text-[#999] mb-1">
          <span>予算消化率</span><span>{pct.toFixed(1)}%</span>
        </div>
        <div className="h-2 bg-silver rounded-full overflow-hidden">
          <div className="h-full bg-violet rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-white border border-silver rounded-xl p-3">
          <p className="text-xs font-semibold text-[#999] uppercase tracking-wider mb-3">カテゴリ別</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => formatCurrency(v)} />
              <Bar dataKey="計画" fill="#D9D9D9" radius={[3, 3, 0, 0]} />
              <Bar dataKey="実績" fill="#9664F7" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Items table */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-[#999] uppercase tracking-wider">明細</p>
          <Button size="sm" onClick={() => setAddModal(true)}>+ 追加</Button>
        </div>
        {budget.items.length === 0 ? (
          <EmptyState icon="📊" title="明細がありません"
            action={<Button size="sm" onClick={() => setAddModal(true)}>明細を追加</Button>} />
        ) : (
          <div className="bg-white border border-silver rounded-xl overflow-hidden">
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto] text-[11px] font-semibold uppercase tracking-wider text-[#999] px-4 py-2.5 border-b border-silver gap-3">
              <span>カテゴリ</span><span>名称</span><span className="text-right">計画</span><span className="text-right">実績</span><span>状態</span>
            </div>
            <div className="divide-y divide-silver/60">
              {budget.items.map((item) => (
                <div key={item.id}
                  className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center px-4 py-2.5 gap-3 hover:bg-snow cursor-pointer"
                  onClick={() => setEditItem(item)}>
                  <span className="text-xs bg-snow px-2 py-0.5 rounded-full">{item.category}</span>
                  <span className="text-sm truncate">{item.name}</span>
                  <span className="text-sm text-right">{formatCurrency(item.planned_amount, budget.currency)}</span>
                  <span className="text-sm text-right">{formatCurrency(item.actual_amount, budget.currency)}</span>
                  <Badge bg={statusColors[item.status].bg} color={statusColors[item.status].color}>
                    {statusLabels[item.status]}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <BudgetItemModal
        open={addModal || !!editItem}
        onClose={() => { setAddModal(false); setEditItem(null) }}
        budgetId={budget.id}
        item={editItem}
        onSaved={() => { setAddModal(false); setEditItem(null); load() }}
      />
    </div>
  )
}

const BudgetItemModal: React.FC<{
  open: boolean; onClose: () => void;
  budgetId: string; item?: BudgetItem | null; onSaved: () => void
}> = ({ open, onClose, budgetId, item, onSaved }) => {
  const [form, setForm] = useState({ category: '', name: '', description: '', planned_amount: 0, actual_amount: 0, date: '', status: 'planned' })

  useEffect(() => {
    if (item) setForm({ category: item.category, name: item.name, description: item.description,
      planned_amount: item.planned_amount, actual_amount: item.actual_amount, date: item.date || '', status: item.status })
    else setForm({ category: '', name: '', description: '', planned_amount: 0, actual_amount: 0, date: '', status: 'planned' })
  }, [item, open])

  async function submit() {
    if (!form.name || !form.category) return
    if (item) await budgetApi.updateItem(item.id, form)
    else await budgetApi.addItem(budgetId, form)
    onSaved()
  }

  return (
    <Modal open={open} onClose={onClose} title={item ? '明細を編集' : '明細を追加'}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label="カテゴリ *" placeholder="人件費、外注費..." value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <Input label="名称 *" placeholder="項目名" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="計画額" type="number" value={form.planned_amount}
            onChange={(e) => setForm({ ...form, planned_amount: Number(e.target.value) })} />
          <Input label="実績額" type="number" value={form.actual_amount}
            onChange={(e) => setForm({ ...form, actual_amount: Number(e.target.value) })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="日付" type="date" value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Select label="状態" value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="planned">計画中</option>
            <option value="pending">承認待ち</option>
            <option value="paid">支払済</option>
          </Select>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        {item && (
          <Button variant="danger" size="sm" onClick={async () => {
            await budgetApi.deleteItem(item.id); onSaved()
          }}>削除</Button>
        )}
        <Button variant="ghost" onClick={onClose}>キャンセル</Button>
        <Button onClick={submit}>{item ? '保存' : '追加'}</Button>
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// WhiteboardTool
// ─────────────────────────────────────────────────────────────────────────

const TldrawComponent = lazy(() => import('./TldrawWrapper'))

export const WhiteboardTool: React.FC<{ projectId: string; blockId?: string }> = ({ projectId, blockId }) => {
  return (
    <div className="h-[520px] rounded-2xl overflow-hidden border border-silver">
      <Suspense fallback={<div className="flex items-center justify-center h-full"><Spinner /><span className="ml-2 text-sm text-[#999]">ホワイトボードを読み込み中...</span></div>}>
        <TldrawComponent projectId={projectId} blockId={blockId} />
      </Suspense>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// ResourceEmbed
// ─────────────────────────────────────────────────────────────────────────

const RESOURCE_ICONS: Record<string, string> = {
  link: '🔗', google_doc: '📄', figma: '🎨', notion: '📝', pdf: '📕', other: '📎'
}
const RESOURCE_LABELS: Record<string, string> = {
  link: 'リンク', google_doc: 'Google Doc', figma: 'Figma', notion: 'Notion', pdf: 'PDF', other: 'その他'
}

export const ResourceEmbed: React.FC<{ projectId: string; blockId?: string }> = ({ projectId, blockId }) => {
  const [resources, setResources] = useState<Resource[]>([])
  const [addModal, setAddModal] = useState(false)
  const [form, setForm] = useState({ title: '', url: '', resource_type: 'link' })
  const [preview, setPreview] = useState<Resource | null>(null)

  useEffect(() => { load() }, [projectId, blockId])

  async function load() {
    try {
      const res = await resourcesApi.list(projectId, blockId)
      setResources(res.data)
    } catch {}
  }

  async function addResource() {
    if (!form.title || !form.url) return
    await resourcesApi.add({ ...form, project_id: projectId, block_id: blockId })
    setForm({ title: '', url: '', resource_type: 'link' })
    setAddModal(false)
    load()
  }

  async function deleteResource(id: string) {
    await resourcesApi.delete(id)
    load()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-[#999] uppercase tracking-wider">関連資料</p>
        <Button size="sm" onClick={() => setAddModal(true)}>+ 追加</Button>
      </div>

      {resources.length === 0 ? (
        <EmptyState icon="📎" title="資料がありません"
          action={<Button size="sm" onClick={() => setAddModal(true)}>資料を追加</Button>} />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {resources.map((r) => (
            <div key={r.id} className="bg-white border border-silver rounded-xl p-3 group hover:shadow-card transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                  <span className="text-2xl flex-shrink-0">{RESOURCE_ICONS[r.resource_type]}</span>
                  <div className="min-w-0">
                    <a href={r.url} target="_blank" rel="noopener noreferrer"
                      className="font-medium text-sm hover:text-violet transition-colors truncate block">
                      {r.title}
                    </a>
                    <p className="text-xs text-[#bbb] mt-0.5">{RESOURCE_LABELS[r.resource_type]}</p>
                  </div>
                </div>
                <button
                  onClick={() => deleteResource(r.id)}
                  className="opacity-0 group-hover:opacity-100 text-[#ccc] hover:text-red-400 text-sm ml-2 flex-shrink-0 transition-all">
                  ×
                </button>
              </div>
              {/* Try to embed if it's an iframe-friendly URL */}
              <button
                onClick={() => setPreview(r)}
                className="mt-2 w-full text-xs text-violet hover:underline text-left"
              >
                プレビュー →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="資料を追加">
        <div className="space-y-3">
          <Input label="タイトル *" placeholder="ドキュメント名" value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Input label="URL *" placeholder="https://..." value={form.url}
            onChange={(e) => {
              const url = e.target.value
              let resource_type = 'link'
              if (url.includes('docs.google.com')) resource_type = 'google_doc'
              else if (url.includes('figma.com')) resource_type = 'figma'
              else if (url.includes('notion.so')) resource_type = 'notion'
              else if (url.endsWith('.pdf')) resource_type = 'pdf'
              setForm({ ...form, url, resource_type })
            }} />
          <Select label="種類" value={form.resource_type}
            onChange={(e) => setForm({ ...form, resource_type: e.target.value })}>
            <option value="link">リンク</option>
            <option value="google_doc">Google Doc</option>
            <option value="figma">Figma</option>
            <option value="notion">Notion</option>
            <option value="pdf">PDF</option>
            <option value="other">その他</option>
          </Select>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={() => setAddModal(false)}>キャンセル</Button>
          <Button onClick={addResource}>追加</Button>
        </div>
      </Modal>

      {/* Preview Modal */}
      {preview && (
        <Modal open onClose={() => setPreview(null)} title={preview.title} size="full">
          <div className="h-[500px]">
            <iframe
              src={preview.url}
              className="w-full h-full rounded-xl border border-silver"
              title={preview.title}
              allow="fullscreen"
            />
          </div>
          <div className="flex justify-between items-center mt-3">
            <a href={preview.url} target="_blank" rel="noopener noreferrer"
              className="text-sm text-violet hover:underline">外部で開く →</a>
            <Button variant="ghost" onClick={() => setPreview(null)}>閉じる</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
