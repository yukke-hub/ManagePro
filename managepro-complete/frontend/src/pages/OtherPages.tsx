import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import { usersApi, orgsApi, paypalApi } from '../api'
import { useAuthStore, useOrgStore } from '../stores'
import { Header } from '../components/layout/Header'
import { Button, Input, Select, Textarea, Avatar, Card, Modal, Spinner, Badge } from '../components/common'
import { formatDate, JOB_TYPE_LABELS, cn } from '../utils'
import type { CalendarEvent } from '../types'

// ─── Profile Page ─────────────────────────────────────────────────────────

export const ProfilePage: React.FC = () => {
  const { user, setUser } = useAuthStore()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', job_type: 'other', avatar_url: '' })
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'profile' | 'calendar'>('profile')

  useEffect(() => {
    if (user) {
      setForm({ username: user.username, job_type: user.job_type, avatar_url: user.avatar_url || '' })
    }
  }, [user])

  async function saveProfile() {
    setSaving(true)
    try {
      await usersApi.updateProfile(form)
      setUser({ ...user!, ...form })
    } catch {} finally { setSaving(false) }
  }

  const sub = user?.subscription_status
  const isActive = sub === 'active'
  const isTrial = sub === 'trial'

  return (
    <div className="min-h-screen bg-snow">
      <Header />
      <main className="pt-14 max-w-4xl mx-auto px-4 pb-24">
        <div className="py-8">
          <h1 className="text-2xl font-bold tracking-tight">プロフィール</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
          {/* Left sidebar */}
          <div className="space-y-4">
            <Card className="p-5 flex flex-col items-center text-center gap-4">
              <div className="relative">
                <Avatar name={user?.username || 'U'} src={user?.avatar_url} size="lg" />
                {user?.status_emoji && (
                  <span className="absolute -bottom-1 -right-1 text-lg leading-none">{user.status_emoji}</span>
                )}
              </div>
              <div>
                <p className="font-semibold">{user?.username}</p>
                <p className="text-xs text-[#999]">{user?.email}</p>
                <p className="text-xs text-violet mt-0.5">{JOB_TYPE_LABELS[user?.job_type || 'other']}</p>
              </div>
              {user?.status_text && (
                <div className="bg-snow px-3 py-1.5 rounded-full text-sm text-[#555] w-full">
                  {user.status_text}
                </div>
              )}
              {user?.note_text && (
                <div className="bg-snow px-3 py-2 rounded-xl text-xs text-[#666] italic w-full text-left">
                  📝 {user.note_text}
                </div>
              )}
            </Card>

            {/* Subscription */}
            <Card className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#999] mb-3">プラン</p>
              <div className={cn(
                'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold mb-2',
                isActive ? 'bg-green-100 text-green-700'
                : isTrial ? 'bg-violet/10 text-violet'
                : 'bg-red-100 text-red-600'
              )}>
                {isActive ? '✅ 有効' : isTrial ? '🔄 試用中' : '❌ 未契約'}
              </div>
              {isTrial && user?.trial_ends_at && (
                <p className="text-xs text-[#999] mb-3">試用終了: {formatDate(user.trial_ends_at)}</p>
              )}
              {isActive && user?.subscription_expires_at && (
                <p className="text-xs text-[#999] mb-3">次回更新: {formatDate(user.subscription_expires_at)}</p>
              )}
              {!isActive && (
                <Button size="sm" className="w-full mt-1" onClick={() => navigate('/subscribe')}>
                  プランに加入する
                </Button>
              )}
            </Card>
          </div>

          {/* Right content */}
          <div className="space-y-4">
            {/* Tab switcher */}
            <div className="flex gap-1 bg-silver/50 p-1 rounded-xl w-fit">
              {(['profile', 'calendar'] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={cn('px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
                    tab === t ? 'bg-white text-ink shadow-card' : 'text-[#888] hover:text-ink')}>
                  {t === 'profile' ? '👤 基本情報' : '📅 カレンダー'}
                </button>
              ))}
            </div>

            {tab === 'profile' && (
              <Card className="p-5">
                <h2 className="font-semibold mb-4">基本情報</h2>
                <div className="space-y-4">
                  <Input label="ユーザー名" value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })} />
                  <Select label="職種" value={form.job_type}
                    onChange={(e) => setForm({ ...form, job_type: e.target.value })}>
                    {Object.entries(JOB_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </Select>
                  <Input label="アバター画像URL（任意）" placeholder="https://..." value={form.avatar_url}
                    onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} />
                  {form.avatar_url && (
                    <div className="flex items-center gap-3 p-3 bg-snow rounded-xl">
                      <img src={form.avatar_url} alt="preview" className="w-10 h-10 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = '' }} />
                      <p className="text-xs text-[#999]">プレビュー</p>
                    </div>
                  )}
                  <div className="flex justify-end pt-1">
                    <Button loading={saving} onClick={saveProfile}>変更を保存</Button>
                  </div>
                </div>
              </Card>
            )}

            {tab === 'calendar' && (
              <Card className="p-4">
                <h2 className="font-semibold mb-4">📅 スケジュール</h2>
                <FullCalendar
                  plugins={[dayGridPlugin, timeGridPlugin]}
                  initialView="timeGridWeek"        
                  locale="ja"
                  headerToolbar={{
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,timeGridDay'
                  }}
                  height={480}
                  datesSet={async (info: any) => {
                    try {
                      const res = await usersApi.getCalendar(info.startStr, info.endStr)
                      setEvents(res.data)
                    } catch {}
                  }}
                  events={events.map((e) => ({
                    id: e.id,
                    title: e.title,
                    start: e.start_at,
                    end: e.end_at || undefined,
                    allDay: !!e.all_day,
                    backgroundColor: e.color,
                    borderColor: e.color,
                  }))}
                />
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

// ─── Organization Settings ────────────────────────────────────────────────

export const OrgSettingsPage: React.FC = () => {
  const { activeOrgId, setOrganizations } = useOrgStore()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [members, setMembers] = useState<any[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteMsg, setInviteMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', logo_url: '' })
  const [logoPreview, setLogoPreview] = useState('')

  useEffect(() => { if (activeOrgId) load(activeOrgId) }, [activeOrgId])

  async function load(id: string) {
    try {
      const [orgRes, membersRes] = await Promise.all([orgsApi.get(id), orgsApi.getMembers(id)])
      setMembers(membersRes.data)
      setForm({ name: orgRes.data.name, description: orgRes.data.description || '', logo_url: orgRes.data.logo_url || '' })
      setLogoPreview(orgRes.data.logo_url || '')
    } catch {}
  }

  async function save() {
    if (!activeOrgId) return
    setSaving(true)
    try {
      await orgsApi.update(activeOrgId, form)
      const res = await orgsApi.list()
      setOrganizations(res.data)
    } catch {} finally { setSaving(false) }
  }

  async function invite() {
    if (!activeOrgId || !inviteEmail.trim()) return
    try {
      await orgsApi.invite(activeOrgId, { email: inviteEmail.trim() })
      setInviteMsg('✅ メンバーを追加しました')
      setInviteEmail('')
      load(activeOrgId)
    } catch (e: any) {
      setInviteMsg('⚠️ ' + (e.response?.data?.error || '招待に失敗しました'))
    }
  }

  async function removeMember(userId: string) {
    if (!activeOrgId || !confirm('このメンバーを削除しますか？')) return
    await orgsApi.removeMember(activeOrgId, userId)
    load(activeOrgId)
  }

  const ROLE_LABELS: Record<string, string> = { owner: 'オーナー', admin: '管理者', member: 'メンバー' }
  const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
    owner: { bg: '#F3E8FF', color: '#7C3AED' },
    admin: { bg: '#DBEAFE', color: '#1D4ED8' },
    member: { bg: '#F3F4F6', color: '#6B7280' },
  }

  return (
    <div className="min-h-screen bg-snow">
      <Header />
      <main className="pt-14 max-w-3xl mx-auto px-4 pb-24">
        <div className="py-8">
          <h1 className="text-2xl font-bold tracking-tight">組織設定</h1>
        </div>

        <div className="space-y-6">
          {/* Basic info */}
          <Card className="p-5">
            <h2 className="font-semibold mb-4">基本情報</h2>
            <div className="space-y-3">
              <Input label="組織名 *" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Textarea label="組織概要" rows={3} value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <div>
                <Input label="ロゴ画像URL（任意）" placeholder="https://... (PNG/SVG推奨, 正方形)"
                  value={form.logo_url}
                  onChange={(e) => { setForm({ ...form, logo_url: e.target.value }); setLogoPreview(e.target.value) }} />
                {logoPreview && (
                  <div className="flex items-center gap-3 mt-2 p-3 bg-snow rounded-xl">
                    <img src={logoPreview} alt="logo preview"
                      className="w-10 h-10 rounded-xl object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3' }} />
                    <p className="text-xs text-[#999]">ロゴプレビュー（ヘッダーに表示されます）</p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button loading={saving} onClick={save}>保存</Button>
            </div>
          </Card>

          {/* Members */}
          <Card className="p-5">
            <h2 className="font-semibold mb-4">メンバー ({members.length}人)</h2>
            <div className="space-y-0 mb-5 divide-y divide-silver/60">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 py-3">
                  <div className="relative">
                    <Avatar name={m.username} src={m.avatar_url} size="sm" />
                    {m.status_emoji && (
                      <span className="absolute -bottom-0.5 -right-0.5 text-xs leading-none">{m.status_emoji}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{m.username}</p>
                    <p className="text-xs text-[#999]">{m.email}</p>
                    {m.status_text && <p className="text-xs text-violet">{m.status_text}</p>}
                  </div>
                  <Badge bg={ROLE_COLORS[m.role].bg} color={ROLE_COLORS[m.role].color}>
                    {ROLE_LABELS[m.role]}
                  </Badge>
                  {m.id !== user?.id && m.role !== 'owner' && (
                    <button onClick={() => removeMember(m.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-[#ccc] hover:text-red-400 hover:bg-red-50 transition-all text-sm">
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Invite */}
            <div className="p-4 bg-snow rounded-xl">
              <p className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-3">メンバーを招待</p>
              <p className="text-xs text-[#999] mb-2">ManageProに登録済みのユーザーのメールアドレスを入力してください</p>
              <div className="flex gap-2">
                <Input
                  placeholder="example@email.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && invite()}
                />
                <Button onClick={invite} disabled={!inviteEmail.trim()}>追加</Button>
              </div>
              {inviteMsg && (
                <p className={cn('text-xs mt-2', inviteMsg.startsWith('✅') ? 'text-green-600' : 'text-red-500')}>
                  {inviteMsg}
                </p>
              )}
            </div>
          </Card>

          {/* Danger zone */}
          <Card className="p-5 border-red-100">
            <h2 className="font-semibold text-red-600 mb-2">危険な操作</h2>
            <p className="text-sm text-[#999] mb-3">組織を削除すると、すべてのプロジェクト・タスク・データが消去されます。</p>
            <Button variant="danger" size="sm" onClick={() => alert('この機能は管理者にお問い合わせください')}>
              組織を削除
            </Button>
          </Card>
        </div>
      </main>
    </div>
  )
}

// ─── Onboarding ───────────────────────────────────────────────────────────

export const OnboardingPage: React.FC = () => {
  const navigate = useNavigate()
  const { setOrganizations, setActiveOrg } = useOrgStore()
  const [form, setForm] = useState({ name: '', description: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function createOrg(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('組織名を入力してください'); return }
    setLoading(true)
    try {
      const res = await orgsApi.create(form)
      const orgsRes = await orgsApi.list()
      setOrganizations(orgsRes.data)
      setActiveOrg(res.data.id)
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.error || '組織の作成に失敗しました')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-snow flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-violet rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-modal">
            <span className="text-white text-2xl">🚀</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">組織を作成しましょう</h1>
          <p className="text-[#999] text-sm mt-2">
            Figmaの「チーム」のように、組織ごとにプロジェクトを管理できます
          </p>
        </div>

        <Card className="p-6">
          <form onSubmit={createOrg} className="space-y-4">
            <Input
              label="組織名 *"
              placeholder="会社名、チーム名、プロジェクト名など"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Textarea
              label="概要（任意）"
              placeholder="この組織について一言"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <div className="flex flex-col gap-2 pt-1">
              <Button type="submit" loading={loading} className="w-full !h-10">
                組織を作成して始める
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => navigate('/')}>
                後で作成する
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}

// ─── Subscribe Page (PayPal) ──────────────────────────────────────────────

declare global { interface Window { paypal: any } }

export const SubscribePage: React.FC = () => {
  const navigate = useNavigate()
  const { setUser, user } = useAuthStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const [config, setConfig] = useState<{ client_id: string; plan_id: string; mode: string } | null>(null)
  const [rendered, setRendered] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    paypalApi.getConfig().then((res) => setConfig(res.data)).catch(() => setError('PayPal設定を取得できませんでした'))
  }, [])

  useEffect(() => {
    if (!config || rendered || !containerRef.current) return

    const script = document.createElement('script')
    script.src = `https://www.paypal.com/sdk/js?client-id=${config.client_id}&vault=true&intent=subscription`
    script.setAttribute('data-sdk-integration-source', 'button-factory')
    script.async = true
    script.onload = () => {
      if (!containerRef.current || !window.paypal) return
      setRendered(true)
      window.paypal.Buttons({
        style: { shape: 'rect', color: 'gold', layout: 'vertical', label: 'subscribe' },
        createSubscription: (_data: any, actions: any) =>
          actions.subscription.create({ plan_id: config.plan_id }),
        onApprove: async (data: any) => {
          try {
            await paypalApi.recordSubscription(data.subscriptionID)
            setUser({ ...user!, subscription_status: 'active' })
            setSuccess(true)
          } catch { setError('サブスクリプションの記録に失敗しました') }
        },
        onError: () => setError('PayPal決済でエラーが発生しました。もう一度お試しください。'),
      }).render(containerRef.current)
    }
    document.head.appendChild(script)
    return () => { try { document.head.removeChild(script) } catch {} }
  }, [config])

  if (success) {
    return (
      <div className="min-h-screen bg-snow flex items-center justify-center">
        <div className="text-center max-w-sm px-4">
          <div className="text-6xl mb-4 animate-bounce">🎉</div>
          <h1 className="text-2xl font-bold mb-2">ありがとうございます！</h1>
          <p className="text-[#999] mb-6">サブスクリプションが有効になりました。ManageProをフルでお使いいただけます。</p>
          <Button onClick={() => navigate('/')} className="w-full">ホームへ</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-snow flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-violet rounded-2xl flex items-center justify-center mb-4 shadow-modal">
            <span className="text-white font-bold text-xl">M</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">ManagePro プラン</h1>
          <p className="text-[#999] text-sm mt-1">チーム全員で使える本格プロジェクト管理</p>
        </div>

        <Card className="p-6 mb-4">
          {/* Price */}
          <div className="text-center mb-5 pb-5 border-b border-silver">
            <div className="flex items-end justify-center gap-1">
              <span className="text-4xl font-bold tracking-tight">¥1,500</span>
              <span className="text-[#999] mb-1"> / 月</span>
            </div>
            <p className="text-xs text-[#bbb] mt-1">税込 · PayPal で安全に決済</p>
          </div>

          {/* Features */}
          <ul className="space-y-2.5 text-sm text-[#555] mb-6">
            {[
              '✅ 無制限のプロジェクト',
              '✅ 無制限のメンバー招待',
              '✅ タスク管理・カンバンボード',
              '✅ スレッドチャット',
              '✅ Jitsi ビデオ会議',
              '✅ tldraw ホワイトボード',
              '✅ 予算管理・グラフ',
              '✅ カレンダー統合',
              '✅ 資料埋め込み',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">{item}</li>
            ))}
          </ul>

          {/* PayPal Button */}
          <div ref={containerRef} className="min-h-[50px]">
            {!rendered && !error && (
              <div className="flex justify-center py-3">
                <Spinner />
                <span className="ml-2 text-sm text-[#999]">PayPalを読み込み中...</span>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-3 p-3 bg-red-50 rounded-xl text-sm text-red-600">
              ⚠️ {error}
            </div>
          )}
        </Card>

        <div className="text-center space-y-2">
          <p className="text-xs text-[#bbb]">いつでもキャンセル可能です</p>
          <button onClick={() => navigate('/')} className="text-sm text-[#999] hover:text-ink transition-colors">
            後で設定する →
          </button>
        </div>
      </div>
    </div>
  )
}
