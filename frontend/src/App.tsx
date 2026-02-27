import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sileo'
import 'sileo/styles.css'
import { useAuthStore } from './store/useAuthStore'
import { useTheme } from './contexts/ThemeContext'
import { deriveThemeFromHex } from './utils/colorMath'
import { SuperAdminLayout } from './layouts/SuperAdminLayout'
import { SuperAdminDashboard } from './pages/SuperAdminDashboard'
import { AdminLayout } from './layouts/AdminLayout'
import { AdminDashboard } from './pages/AdminDashboard'
import { AdminMembers } from './pages/AdminMembers'
import { AdminFinance } from './pages/AdminFinance'
import { AdminAudit } from './pages/AdminAudit'
import { AdminClasses } from './pages/AdminClasses'
import { AdminRoutines } from './pages/AdminRoutines'
import { AdminInventory } from './pages/AdminInventory'
import { AdminShifts } from './pages/AdminShifts'
import { AdminRewards } from './pages/AdminRewards'
import { AdminLeaderboard } from './pages/AdminLeaderboard'
import { AdminStaffView } from './pages/AdminStaffView'
import { AdminRoute } from './components/auth/AdminRoute'
import { ReceptionLayout } from './layouts/ReceptionLayout'
import { ReceptionCheckInPage } from './pages/ReceptionCheckIn'
import { ReceptionPosPage } from './pages/ReceptionPos'
import { ReceptionMemberNewPage } from './pages/ReceptionMemberNew'
import { ReceptionMembersPage } from './pages/ReceptionMembers'
import { ReceptionRoute } from './components/auth/ReceptionRoute'
import { MemberLayout } from './layouts/MemberLayout'
import { MemberHome } from './pages/MemberHome'
import { MemberClasses } from './pages/MemberClasses'
import { MemberRewards } from './pages/MemberRewards'
import { MemberHistory } from './pages/MemberHistory'
import { MemberRoute } from './components/auth/MemberRoute'
import { ProfileSettings } from './pages/ProfileSettings'

const DEFAULT_TITLE = 'NexoGym'

const NEXO_PRIMARY = '#2563eb'

const useApplyTenantTheme = () => {
  const user = useAuthStore((state) => state.user)
  const tenantTheme = useAuthStore((state) => state.tenantTheme)

  useEffect(() => {
    const root = document.documentElement
    // SUPERADMIN siempre usa marca Nexo Gym (no heredar colores de ningún gym).
    const hex = user?.role === 'SUPERADMIN' ? NEXO_PRIMARY : (tenantTheme?.primaryHex ?? NEXO_PRIMARY)
    const { primary, primaryForeground } = deriveThemeFromHex(hex)

    root.style.setProperty('--theme-primary', primary)
    root.style.setProperty('--theme-primary-foreground', primaryForeground)
  }, [user?.role, tenantTheme])
}

/** Título de pestaña y PWA: NexoGym para SUPERADMIN; para el resto, nombre del gym (white-label). */
const useDocumentTitle = () => {
  const user = useAuthStore((state) => state.user)
  const gymName = useAuthStore((state) => state.gymName)

  useEffect(() => {
    const title =
      user?.role === 'SUPERADMIN' ? DEFAULT_TITLE : (user && gymName ? gymName : DEFAULT_TITLE)
    document.title = title
    const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]')
    if (appleTitle) appleTitle.setAttribute('content', title)
  }, [user?.role, user, gymName])
}

const DEFAULT_FAVICON = '/vite.svg'
const DEFAULT_FAVICON_TYPE = 'image/svg+xml'

/** Favicon de pestaña: logo del gym cuando hay sesión y logo; NexoGym por defecto (SUPERADMIN o sin logo). */
const useFavicon = () => {
  const user = useAuthStore((state) => state.user)
  const gymLogoUrl = useAuthStore((state) => state.gymLogoUrl)

  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!link) return
    const useLogo = user && user.role !== 'SUPERADMIN' && gymLogoUrl?.trim()
    if (useLogo) {
      link.href = gymLogoUrl!
      link.type = gymLogoUrl!.toLowerCase().includes('.svg') ? 'image/svg+xml' : 'image/png'
    } else {
      link.href = DEFAULT_FAVICON
      link.type = DEFAULT_FAVICON_TYPE
    }
  }, [user?.role, user, gymLogoUrl])
}

/** Inyecta el manifest PWA tras el bootstrap; si hay sesión, usa cache-buster para que el navegador pida con la cookie y muestre el nombre del gym al instalar. */
const useManifestLink = () => {
  const isBootstrapped = useAuthStore((state) => state.isBootstrapped)
  const user = useAuthStore((state) => state.user)

  useEffect(() => {
    if (!isBootstrapped) return
    const link = document.createElement('link')
    link.rel = 'manifest'
    // Con sesión, cache-buster para forzar re-fetch con cookie y que "Instalar" muestre el nombre del gym
    link.href = user ? `/api/v1/manifest?t=${Date.now()}` : '/api/v1/manifest'
    document.head.appendChild(link)
    return () => link.remove()
  }, [isBootstrapped, user?.id])
}

function App() {
  const { mode } = useTheme()
  useApplyTenantTheme()
  useDocumentTitle()
  useFavicon()
  useManifestLink()
  const user = useAuthStore((state) => state.user)

  const defaultPath = !user
    ? '/login'
    : user.role === 'SUPERADMIN'
      ? '/saas'
      : user.role === 'RECEPTIONIST'
        ? '/reception'
        : user.role === 'MEMBER'
          ? '/member'
          : user.role === 'COACH' || user.role === 'INSTRUCTOR'
            ? '/admin/routines'
            : '/admin'

  return (
    <>
      <Routes>
        <Route path="/saas" element={<SuperAdminLayout />}>
          <Route index element={<SuperAdminDashboard />} />
          <Route path="profile" element={<ProfileSettings />} />
        </Route>

        <Route element={<AdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/members" element={<AdminMembers />} />
            <Route path="/admin/finance" element={<AdminFinance />} />
            <Route path="/admin/classes" element={<AdminClasses />} />
            <Route path="/admin/routines" element={<AdminRoutines />} />
            <Route path="/admin/inventory" element={<AdminInventory />} />
            <Route path="/admin/shifts" element={<AdminShifts />} />
            <Route path="/admin/rewards" element={<AdminRewards />} />
            <Route path="/admin/leaderboard" element={<AdminLeaderboard />} />
            <Route path="/admin/staff" element={<AdminStaffView />} />
            <Route path="/admin/audit" element={<AdminAudit />} />
            <Route path="/admin/profile" element={<ProfileSettings />} />
          </Route>
        </Route>

        <Route element={<ReceptionRoute />}>
          <Route element={<ReceptionLayout />}>
            <Route path="/reception" element={<ReceptionCheckInPage />} />
            <Route path="/reception/pos" element={<ReceptionPosPage />} />
            <Route path="/reception/members" element={<ReceptionMembersPage />} />
            <Route path="/reception/members/new" element={<ReceptionMemberNewPage />} />
            <Route path="/reception/leaderboard" element={<AdminLeaderboard />} />
            <Route path="/reception/profile" element={<ProfileSettings />} />
          </Route>
        </Route>

        <Route element={<MemberRoute />}>
          <Route element={<MemberLayout />}>
            <Route path="/member" element={<MemberHome />} />
            <Route path="/member/classes" element={<MemberClasses />} />
            <Route path="/member/rewards" element={<MemberRewards />} />
            <Route path="/member/history" element={<MemberHistory />} />
            <Route path="/member/profile" element={<ProfileSettings />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to={defaultPath} replace />} />
      </Routes>
      <Toaster position="top-center" theme={mode} />
    </>
  )
}

export default App
