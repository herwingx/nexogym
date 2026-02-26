import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { LoginPage } from './pages/Login'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AuthRestore } from './components/auth/AuthRestore'
import { ThemeProvider } from './contexts/ThemeContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthRestore>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/*" element={<App />} />
            </Route>
          </Routes>
        </AuthRestore>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
