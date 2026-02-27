import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

function securityHeadersPlugin() {
  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
  }
  // CSP en producción debe configurarse en el servidor que sirve index.html (ver .docs/FRONTEND_SECURITY_AUDIT.md)
  return {
    name: 'security-headers',
    configureServer(server: { middlewares: { use: (fn: (req: unknown, res: unknown, next: () => void) => void) => void } }) {
      server.middlewares.use((_req, res: { setHeader: (name: string, value: string) => void }, next: () => void) => {
        Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value))
        next()
      })
    },
    configurePreviewServer(server: { middlewares: { use: (fn: (req: unknown, res: unknown, next: () => void) => void) => void } }) {
      server.middlewares.use((_req, res: { setHeader: (name: string, value: string) => void }, next: () => void) => {
        Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value))
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), securityHeadersPlugin()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    host: true, // permite acceso desde LAN (móvil, tablet) para probar QR/cámara
    allowedHosts: true, // permite ngrok y otros túneles (Host header distinto a localhost)
    proxy: {
      '/api/v1': {
        target: process.env.VITE_API_BASE_URL
          ? new URL(process.env.VITE_API_BASE_URL).origin
          : 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
