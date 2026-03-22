import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { authApi, orgsApi } from './api'
import { useAuthStore, useOrgStore } from './stores'
import { TopPage } from './pages/TopPage'
import { ProjectPage } from './pages/ProjectPage'
import { LoginPage, RegisterPage } from './pages/AuthPages'
import { ProfilePage, OrgSettingsPage, OnboardingPage, SubscribePage } from './pages/OtherPages'
import { Spinner } from './components/common'

// ─── Auth Guard ───────────────────────────────────────────────────────────

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, isAuthenticated } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

// ─── Boot: verify token on load ───────────────────────────────────────────

const Boot: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, setUser, logout } = useAuthStore()
  const { setOrganizations, setActiveOrg, activeOrgId } = useOrgStore()
  const [checking, setChecking] = React.useState(true)

  useEffect(() => {
    async function check() {
      if (!token) { setChecking(false); return }
      try {
        const res = await authApi.me()
        setUser(res.data)
        // Load orgs
        const orgsRes = await orgsApi.list()
        setOrganizations(orgsRes.data)
        if (!activeOrgId && orgsRes.data.length > 0) {
          setActiveOrg(orgsRes.data[0].id)
        }
      } catch {
        logout()
      } finally {
        setChecking(false)
      }
    }
    check()
  }, [])

  if (checking) return (
    <div className="min-h-screen bg-snow flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 bg-violet rounded-2xl flex items-center justify-center">
          <span className="text-white font-bold text-lg">M</span>
        </div>
        <Spinner />
      </div>
    </div>
  )

  return <>{children}</>
}

// ─── App ──────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <Boot>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/onboarding" element={<RequireAuth><OnboardingPage /></RequireAuth>} />
          <Route path="/subscribe" element={<RequireAuth><SubscribePage /></RequireAuth>} />

          {/* Protected */}
          <Route path="/" element={<RequireAuth><TopPage /></RequireAuth>} />
          <Route path="/projects/:id" element={<RequireAuth><ProjectPage /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><OrgSettingsPage /></RequireAuth>} />
          <Route path="/organizations/new" element={<RequireAuth><OnboardingPage /></RequireAuth>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Boot>
    </BrowserRouter>
  )
}
