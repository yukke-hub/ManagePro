import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore, useOrgStore } from '../../stores'
import { usersApi, orgsApi } from '../../api'
import { Avatar, Button, Modal, Input, Textarea } from '../common'
import { cn } from '../../utils'
import type { Organization } from '../../types'

const STATUS_EMOJIS = ['🟢', '🟡', '🔴', '⚫', '🎯', '💻', '☕', '🏃', '📚', '🎵']

export const Header: React.FC = () => {
  const navigate = useNavigate()
  const { user, setUser, logout } = useAuthStore()
  const { organizations, activeOrgId, activeOrg, setActiveOrg, setOrganizations } = useOrgStore()
  const [statusModal, setStatusModal] = useState(false)
  const [orgDropdown, setOrgDropdown] = useState(false)
  const [userDropdown, setUserDropdown] = useState(false)
  const [statusForm, setStatusForm] = useState({ status_emoji: '🟢', status_text: '', note_text: '' })

  useEffect(() => {
    loadOrgs()
  }, [])

  useEffect(() => {
    if (user) {
      setStatusForm({
        status_emoji: user.status_emoji || '🟢',
        status_text: user.status_text || '',
        note_text: user.note_text || '',
      })
    }
  }, [user])

  async function loadOrgs() {
    try {
      const res = await orgsApi.list()
      setOrganizations(res.data)
      if (!activeOrgId && res.data.length > 0) {
        setActiveOrg(res.data[0].id)
      }
    } catch {}
  }

  async function saveStatus() {
    try {
      await usersApi.updateStatus(statusForm)
      setUser({ ...user!, ...statusForm })
      setStatusModal(false)
    } catch {}
  }

  const org = activeOrg()

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-white/90 backdrop-blur-md border-b border-silver flex items-center px-4 gap-3">
        {/* ── Org Switcher ── */}
        <div className="relative">
          <button
            onClick={() => setOrgDropdown(!orgDropdown)}
            className="flex items-center gap-2 h-9 px-3 rounded-xl hover:bg-snow transition-colors"
          >
            {org?.logo_url ? (
              <img src={org.logo_url} alt={org.name} className="w-6 h-6 rounded-lg object-cover" />
            ) : (
              <div className="w-6 h-6 rounded-lg bg-violet flex items-center justify-center">
                <span className="text-white text-[10px] font-bold">
                  {org?.name?.[0]?.toUpperCase() || 'M'}
                </span>
              </div>
            )}
            <span className="font-semibold text-sm max-w-[160px] truncate">{org?.name || 'ManagePro'}</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-[#999]">
              <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
            </svg>
          </button>

          {orgDropdown && (
            <div className="absolute top-full left-0 mt-1.5 bg-white border border-silver rounded-xl shadow-modal min-w-[200px] py-1 z-50 animate-scale-in">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-[#999] uppercase tracking-wider">組織</div>
              {organizations.map((o) => (
                <button
                  key={o.id}
                  onClick={() => { setActiveOrg(o.id); setOrgDropdown(false) }}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-snow transition-colors',
                    o.id === activeOrgId && 'text-violet font-medium'
                  )}
                >
                  <div className="w-6 h-6 rounded-lg bg-violet/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-violet text-[10px] font-bold">{o.name[0].toUpperCase()}</span>
                  </div>
                  <span className="truncate">{o.name}</span>
                  {o.id === activeOrgId && <span className="ml-auto text-violet">✓</span>}
                </button>
              ))}
              <div className="border-t border-silver my-1" />
              <button
                onClick={() => { navigate('/organizations/new'); setOrgDropdown(false) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-violet hover:bg-violet/5 transition-colors"
              >
                <span className="w-6 h-6 flex items-center justify-center text-lg">+</span>
                新しい組織を作成
              </button>
            </div>
          )}
        </div>

        {/* ── Logo ── */}
        <div
          className="flex items-center gap-1.5 cursor-pointer flex-shrink-0"
          onClick={() => navigate('/')}
        >
          <img src="/logo.svg" alt="ManagePro" className="h-6 w-auto" onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none'
          }} />
          <span className="font-bold text-sm tracking-tight hidden sm:block">ManagePro</span>
        </div>

        <div className="flex-1" />

        {/* ── Nav ── */}
        <nav className="hidden md:flex items-center gap-1">
          {[
            { label: 'ホーム', path: '/' },
            { label: 'プロフィール', path: '/profile' },
          ].map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="px-3 py-1.5 text-sm rounded-lg text-[#666] hover:text-ink hover:bg-snow transition-colors"
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* ── User ── */}
        <div className="relative">
          <button
            onClick={() => setUserDropdown(!userDropdown)}
            className="flex items-center gap-2 h-9 px-2 rounded-xl hover:bg-snow transition-colors"
          >
            <div className="relative">
              <Avatar name={user?.username || 'U'} src={user?.avatar_url} size="sm" />
              <span className="absolute -bottom-0.5 -right-0.5 text-xs leading-none">
                {user?.status_emoji || '🟢'}
              </span>
            </div>
            <span className="text-sm font-medium hidden sm:block max-w-[100px] truncate">{user?.username}</span>
          </button>

          {userDropdown && (
            <div className="absolute top-full right-0 mt-1.5 bg-white border border-silver rounded-xl shadow-modal min-w-[220px] z-50 animate-scale-in">
              <div className="px-4 py-3 border-b border-silver">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar name={user?.username || 'U'} src={user?.avatar_url} size="md" />
                    <span className="absolute -bottom-0.5 -right-0.5 text-sm leading-none">{user?.status_emoji || '🟢'}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{user?.username}</p>
                    <p className="text-xs text-[#999] truncate">{user?.email}</p>
                    {user?.status_text && <p className="text-xs text-violet mt-0.5 truncate">{user.status_text}</p>}
                  </div>
                </div>
                {user?.note_text && (
                  <div className="mt-2 px-2 py-1.5 bg-snow rounded-lg text-xs text-[#666] italic">
                    📝 {user.note_text}
                  </div>
                )}
              </div>

              <div className="py-1">
                <button
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-snow transition-colors"
                  onClick={() => { setStatusModal(true); setUserDropdown(false) }}
                >
                  <span>✏️</span> ステータスを編集
                </button>
                <button
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-snow transition-colors"
                  onClick={() => { navigate('/profile'); setUserDropdown(false) }}
                >
                  <span>👤</span> プロフィール
                </button>
                <button
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-snow transition-colors"
                  onClick={() => { navigate('/settings'); setUserDropdown(false) }}
                >
                  <span>⚙️</span> 設定
                </button>
                <div className="border-t border-silver my-1" />
                <button
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                  onClick={() => { logout(); navigate('/login') }}
                >
                  <span>🚪</span> ログアウト
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ── Click outside to close dropdowns ── */}
      {(orgDropdown || userDropdown) && (
        <div className="fixed inset-0 z-30" onClick={() => { setOrgDropdown(false); setUserDropdown(false) }} />
      )}

      {/* ── Status Edit Modal ── */}
      <Modal open={statusModal} onClose={() => setStatusModal(false)} title="ステータスを編集">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-[#666] block mb-2">ステータス絵文字</label>
            <div className="flex flex-wrap gap-2">
              {STATUS_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setStatusForm({ ...statusForm, status_emoji: emoji })}
                  className={cn(
                    'w-9 h-9 flex items-center justify-center text-xl rounded-xl transition-all',
                    statusForm.status_emoji === emoji
                      ? 'bg-violet/15 ring-2 ring-violet'
                      : 'bg-snow hover:bg-silver'
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <Input
            label="ユーザーステータス"
            placeholder="例: 会議中、集中してます..."
            value={statusForm.status_text}
            onChange={(e) => setStatusForm({ ...statusForm, status_text: e.target.value })}
          />

          <Textarea
            label="ユーザーノート (インスタのノートのように)"
            placeholder="今日の一言、作業中のこと..."
            rows={3}
            value={statusForm.note_text}
            onChange={(e) => setStatusForm({ ...statusForm, note_text: e.target.value })}
          />

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setStatusModal(false)}>キャンセル</Button>
            <Button onClick={saveStatus}>保存</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
