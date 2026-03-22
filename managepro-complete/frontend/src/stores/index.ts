import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Organization } from '../types'

// ─── Auth Store ───────────────────────────────────────────────────────────

interface AuthState {
  token: string | null
  user: User | null
  setToken: (token: string) => void
  setUser: (user: User) => void
  logout: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      setToken: (token) => {
        localStorage.setItem('mp_token', token)
        set({ token })
      },
      setUser: (user) => set({ user }),
      logout: () => {
        localStorage.removeItem('mp_token')
        set({ token: null, user: null })
      },
      isAuthenticated: () => !!get().token && !!get().user,
    }),
    { name: 'mp_auth', partialize: (s) => ({ token: s.token, user: s.user }) }
  )
)

// ─── Organization Store ───────────────────────────────────────────────────

interface OrgState {
  organizations: Organization[]
  activeOrgId: string | null
  setOrganizations: (orgs: Organization[]) => void
  setActiveOrg: (id: string) => void
  activeOrg: () => Organization | null
}

export const useOrgStore = create<OrgState>()(
  persist(
    (set, get) => ({
      organizations: [],
      activeOrgId: null,
      setOrganizations: (organizations) => set({ organizations }),
      setActiveOrg: (id) => set({ activeOrgId: id }),
      activeOrg: () => get().organizations.find((o) => o.id === get().activeOrgId) || null,
    }),
    { name: 'mp_org', partialize: (s) => ({ activeOrgId: s.activeOrgId }) }
  )
)

// ─── UI Store ─────────────────────────────────────────────────────────────

interface UIState {
  sidebarOpen: boolean
  setSidebarOpen: (v: boolean) => void
  toggleSidebar: () => void
  modalOpen: string | null // modal key
  openModal: (key: string) => void
  closeModal: () => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  modalOpen: null,
  openModal: (key) => set({ modalOpen: key }),
  closeModal: () => set({ modalOpen: null }),
}))
