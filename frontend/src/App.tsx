import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sileo'
import 'sileo/styles.css'
import { useAuthStore } from './store/useAuthStore'
import { deriveThemeFromHex } from './utils/colorMath'
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
import { MemberRewards } from './pages/MemberRewards'
import { MemberHistory } from './pages/MemberHistory'
import { MemberRoute } from './components/auth/MemberRoute'
import { ProfileSettings } from './pages/ProfileSettings'

type ThemeMode = 'light' | 'dark'

const useApplyTenantTheme = () => {
  const tenantTheme = useAuthStore((state) => state.tenantTheme)
  const [mode, setMode] = useState<ThemeMode>('dark')

  useEffect(() => {
    const root = document.documentElement
    const { primary, primaryForeground } = deriveThemeFromHex(
      tenantTheme?.primaryHex ?? '#2563eb',
    )

    root.style.setProperty('--theme-primary', primary)
    root.style.setProperty('--theme-primary-foreground', primaryForeground)
  }, [tenantTheme])

  useEffect(() => {
    const root = document.documentElement
    if (mode === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [mode])

  return { mode, setMode }
}

function App() {
  const { mode } = useApplyTenantTheme()
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
        <Route path="/saas" element={<SuperAdminDashboard />} />
        <Route path="/saas/profile" element={<ProfileSettings />} />

        <Route element={<AdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/members" element={<AdminMembers />} />
            <Route path="/admin/finance" element={<AdminFinance />} />
            <Route path="/admin/classes" element={<AdminClasses />} />
            <Route path="/admin/routines" element={<AdminRoutines />} />
            <Route path="/admin/inventory" element={<AdminInventory />} />
            <Route path="/admin/shifts" element={<AdminShifts />} />
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
            <Route path="/reception/profile" element={<ProfileSettings />} />
          </Route>
        </Route>

        <Route element={<MemberRoute />}>
          <Route element={<MemberLayout />}>
            <Route path="/member" element={<MemberHome />} />
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
