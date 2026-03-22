import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authApi, orgsApi } from '../api'
import { useAuthStore, useOrgStore } from '../stores'
import { Button, Input, Select } from '../components/common'
import { cn } from '../utils'

// ─── Login ────────────────────────────────────────────────────────────────

export const LoginPage: React.FC = () => {
  const navigate = useNavigate()
  const { setToken, setUser } = useAuthStore()
  const { setOrganizations, setActiveOrg } = useOrgStore()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await authApi.login(form)
      setToken(res.data.token)
      setUser(res.data.user)
      // Load orgs
      const orgsRes = await orgsApi.list()
      setOrganizations(orgsRes.data)
      if (orgsRes.data.length > 0) setActiveOrg(orgsRes.data[0].id)
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.error || 'ログインに失敗しました')
    } finally { setLoading(false) }
  }

  return <AuthLayout title="おかえりなさい">
    <form onSubmit={submit} className="space-y-3">
      <Input label="メールアドレス" type="email" placeholder="you@example.com" required
        value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <Input label="パスワード" type="password" placeholder="••••••••" required
        value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      <Button type="submit" loading={loading} className="w-full !h-10">ログイン</Button>
    </form>
    <p className="text-sm text-center text-[#999] mt-4">
      アカウントがない？{' '}
      <Link to="/register" className="text-violet hover:underline font-medium">新規登録</Link>
    </p>
  </AuthLayout>
}

// ─── Register ─────────────────────────────────────────────────────────────

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate()
  const { setToken, setUser } = useAuthStore()
  const { setOrganizations } = useOrgStore()
  const [form, setForm] = useState({ email: '', password: '', username: '', job_type: 'other' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password.length < 8) { setError('パスワードは8文字以上にしてください'); return }
    setError('')
    setLoading(true)
    try {
      const res = await authApi.register(form)
      setToken(res.data.token)
      setUser(res.data.user)
      navigate('/onboarding')
    } catch (err: any) {
      setError(err.response?.data?.error || '登録に失敗しました')
    } finally { setLoading(false) }
  }

  return <AuthLayout title="ManageProへようこそ" subtitle="30日間無料でお試しいただけます">
    <form onSubmit={submit} className="space-y-3">
      <Input label="ユーザー名" placeholder="あなたの名前" required
        value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
      <Input label="メールアドレス" type="email" placeholder="you@example.com" required
        value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <Input label="パスワード" type="password" placeholder="8文字以上" required minLength={8}
        value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      <Select label="職種"
        value={form.job_type} onChange={(e) => setForm({ ...form, job_type: e.target.value })}>
        <option value="student">学生</option>
        <option value="designer">デザイナー</option>
        <option value="engineer">エンジニア</option>
        <option value="manager">マネージャー</option>
        <option value="marketing">マーケター</option>
        <option value="sales">営業</option>
        <option value="other">その他</option>
      </Select>
      {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      <Button type="submit" loading={loading} className="w-full !h-10">無料で始める</Button>
    </form>
    <p className="text-xs text-center text-[#bbb] mt-3">
      登録することで利用規約とプライバシーポリシーに同意したことになります
    </p>
    <p className="text-sm text-center text-[#999] mt-3">
      すでにアカウントがある？{' '}
      <Link to="/login" className="text-violet hover:underline font-medium">ログイン</Link>
    </p>
  </AuthLayout>
}

// ─── Shared layout ────────────────────────────────────────────────────────

const AuthLayout: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({
  title, subtitle, children
}) => (
  <div className="min-h-screen bg-snow flex items-center justify-center px-4">
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-14 h-14 bg-violet rounded-2xl flex items-center justify-center mb-4 shadow-modal">
          <img src="/logo.svg" alt="ManagePro" className="w-8 h-8" onError={(e) => {
            const el = e.target as HTMLImageElement
            el.style.display = 'none'
            el.parentElement!.innerHTML = '<span class="text-white font-bold text-xl">M</span>'
          }} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-[#999] mt-1">{subtitle}</p>}
      </div>

      <div className="bg-white border border-silver rounded-2xl p-6 shadow-card">
        {children}
      </div>
    </div>
  </div>
)
