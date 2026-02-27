import { type FormEvent, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuthStore } from '../store/useAuthStore'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { notifyError, notifySuccess } from '../lib/notifications'
import { updateGymThemeColors, updateGymLogo } from '../lib/apiClient'
import { getAccessibleTextColor } from '../utils/colorMath'
import { getGymLogoStoragePath, GYM_LOGOS_BUCKET } from '../lib/storageUtils'

const PRESET_COLORS = [
  { value: '#2563eb', label: 'Azul' },
  { value: '#dc2626', label: 'Rojo' },
  { value: '#059669', label: 'Verde' },
  { value: '#7c3aed', label: 'Violeta' },
  { value: '#f97316', label: 'Naranja' },
  { value: '#6366f1', label: 'Indigo' },
]

export const ProfileSettings = () => {
  const user = useAuthStore((s) => s.user)
  const tenantTheme = useAuthStore((s) => s.tenantTheme)
  const setTenantTheme = useAuthStore((s) => s.setTenantTheme)
  const gymLogoUrl = useAuthStore((s) => s.gymLogoUrl)
  const setGymLogoUrl = useAuthStore((s) => s.setGymLogoUrl)
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [accentColor, setAccentColor] = useState(tenantTheme.primaryHex)
  const [savingColor, setSavingColor] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [removingLogo, setRemovingLogo] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 8) {
      notifyError({
        title: 'Contraseña corta',
        description: 'Usa al menos 8 caracteres.',
      })
      return
    }
    if (newPassword !== newPasswordConfirm) {
      notifyError({
        title: 'No coinciden',
        description: 'La contraseña y la confirmación deben ser iguales.',
      })
      return
    }
    setSubmitting(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setNewPassword('')
      setNewPasswordConfirm('')
      notifySuccess({
        title: 'Contraseña actualizada',
        description: 'Tu contraseña se ha cambiado correctamente.',
      })
    } catch (err) {
      notifyError({
        title: 'No se pudo cambiar la contraseña',
        description: (err as Error)?.message ?? 'Inténtalo de nuevo.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
        Mi perfil
      </h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
        Gestiona tu cuenta y cambia tu contraseña.
      </p>

      <div className="space-y-6">
        <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-4">
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Información de sesión
          </h2>
          <dl className="space-y-1 text-sm">
            <div>
              <dt className="text-zinc-500 dark:text-zinc-500">Nombre</dt>
              <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                {user?.name ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-500">Correo</dt>
              <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                {user?.email ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-500">Rol</dt>
              <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                {user?.role ?? '—'}
              </dd>
            </div>
          </dl>
        </div>

        {user?.role === 'ADMIN' && (
          <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-4">
            <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Color de acento del gimnasio
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
              Personaliza el color de botones y acentos. El contraste del texto se ajusta automáticamente (WCAG).
            </p>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <span className="text-xs text-zinc-500 block mb-1">Vista previa</span>
                <div
                  className="h-9 px-4 rounded-md font-medium shadow-sm flex items-center justify-center text-sm"
                  style={{
                    backgroundColor: accentColor,
                    color: getAccessibleTextColor(accentColor),
                  }}
                >
                  Botón ejemplo
                </div>
              </div>
              <div>
                <span className="text-xs text-zinc-500 block mb-1">Color</span>
                <div className="flex gap-1">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="h-8 w-12 rounded border border-zinc-200 dark:border-white/10 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-24 text-xs"
                    placeholder="#2563eb"
                  />
                </div>
              </div>
              <div className="flex gap-1 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setAccentColor(c.value)}
                    className="h-6 w-6 rounded border border-zinc-200 dark:border-white/10 hover:ring-2 hover:ring-primary/50"
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                  />
                ))}
              </div>
              <Button
                type="button"
                size="sm"
                onClick={async () => {
                  if (!/^#[0-9A-Fa-f]{6}$/.test(accentColor)) {
                    notifyError({ title: 'Color inválido', description: 'Usa formato hexadecimal (ej. #2563eb).' })
                    return
                  }
                  setSavingColor(true)
                  try {
                    await updateGymThemeColors(accentColor)
                    setTenantTheme({ primaryHex: accentColor })
                    notifySuccess({ title: 'Color actualizado', description: 'El color de acento se aplicó correctamente.' })
                  } catch (err) {
                    notifyError({
                      title: 'No se pudo guardar',
                      description: (err as Error)?.message ?? 'Inténtalo de nuevo.',
                    })
                  } finally {
                    setSavingColor(false)
                  }
                }}
                disabled={savingColor}
              >
                {savingColor ? 'Guardando...' : 'Aplicar color'}
              </Button>
            </div>
          </div>
        )}

        {user?.role === 'ADMIN' && (
          <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-4">
            <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Logo del gimnasio
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
              Sube una imagen (JPG, PNG, WebP) o pega una URL. El logo aparece en el header y en la app de socios.
            </p>
            <div className="flex flex-wrap gap-4 items-start">
              {gymLogoUrl ? (
                <div className="relative group">
                  <img
                    src={gymLogoUrl}
                    alt="Logo actual"
                    className="h-16 w-16 rounded-lg border border-zinc-200 dark:border-white/10 object-contain bg-white dark:bg-zinc-800"
                  />
                </div>
              ) : (
                <div className="h-16 w-16 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600 flex items-center justify-center text-zinc-400 dark:text-zinc-500 text-xs">
                  Sin logo
                </div>
              )}
              <div className="flex flex-col gap-2">
                <label className="inline-flex items-center justify-center rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 cursor-pointer disabled:opacity-50">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file?.type.startsWith('image/')) return
                      setUploadingLogo(true)
                      try {
                        const ext = file.name.split('.').pop() || 'jpg'
                        const path = `${crypto.randomUUID()}.${ext}`
                        const { error } = await supabase.storage.from(GYM_LOGOS_BUCKET).upload(path, file, {
                          cacheControl: '3600',
                          upsert: false,
                        })
                        if (error) throw error
                        const { data } = supabase.storage.from(GYM_LOGOS_BUCKET).getPublicUrl(path)
                        const newUrl = data.publicUrl

                        await updateGymLogo(newUrl)
                        setGymLogoUrl(newUrl)

                        if (gymLogoUrl) {
                          const oldPath = getGymLogoStoragePath(gymLogoUrl)
                          if (oldPath) {
                            await supabase.storage.from(GYM_LOGOS_BUCKET).remove([oldPath]).catch(() => {})
                          }
                        }
                        notifySuccess({ title: 'Logo actualizado', description: 'El logo se aplicó correctamente.' })
                      } catch (err) {
                        notifyError({
                          title: 'No se pudo subir el logo',
                          description: (err as Error)?.message ?? 'Revisa que el bucket gym-logos exista en Supabase.',
                        })
                      } finally {
                        setUploadingLogo(false)
                        e.target.value = ''
                      }
                    }}
                    disabled={uploadingLogo}
                  />
                  {uploadingLogo ? 'Subiendo...' : 'Subir imagen'}
                </label>
                {gymLogoUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={removingLogo}
                    onClick={async () => {
                      setRemovingLogo(true)
                      try {
                        const oldPath = getGymLogoStoragePath(gymLogoUrl)
                        if (oldPath) {
                          await supabase.storage.from(GYM_LOGOS_BUCKET).remove([oldPath]).catch(() => {})
                        }
                        await updateGymLogo(null)
                        setGymLogoUrl(null)
                        notifySuccess({ title: 'Logo quitado', description: 'El logo se eliminó correctamente.' })
                      } catch (err) {
                        notifyError({
                          title: 'No se pudo quitar',
                          description: (err as Error)?.message ?? 'Inténtalo de nuevo.',
                        })
                      } finally {
                        setRemovingLogo(false)
                      }
                    }}
                  >
                    {removingLogo ? 'Quitando...' : 'Quitar logo'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-4">
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
            Cambiar contraseña
          </h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              label="Nueva contraseña"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              minLength={8}
            />
            <Input
              label="Confirmar contraseña"
              type="password"
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              placeholder="Repite la contraseña"
              autoComplete="new-password"
              minLength={8}
            />
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Guardando...' : 'Guardar contraseña'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
