import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, Camera } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { createUser } from '../lib/apiClient'
import { notifyError, notifySuccess } from '../lib/notifications'
import { supabase } from '../lib/supabaseClient'
import { useAuthStore } from '../store/useAuthStore'

const PROFILE_BUCKET = 'profile-pictures'

export const ReceptionMemberNewPage = () => {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hasPortal = useAuthStore((s) => s.modulesConfig.qr_access)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [profilePictureUrl, setProfilePictureUrl] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    setUploadingPhoto(true)
    setProfilePictureUrl('')
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage.from(PROFILE_BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      })
      if (error) throw error
      const { data } = supabase.storage.from(PROFILE_BUCKET).getPublicUrl(path)
      setProfilePictureUrl(data.publicUrl)
      notifySuccess({ title: 'Foto lista', description: 'Se usará como foto de perfil.' })
    } catch (err) {
      notifyError({
        title: 'No se pudo subir la foto',
        description: (err as Error)?.message ?? 'Revisa que el bucket "profile-pictures" exista en Supabase.',
      })
    } finally {
      setUploadingPhoto(false)
      e.target.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone.trim()) return
    const emailVal = email.trim()
    if (emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      notifyError({
        title: 'Email no válido',
        description: 'Si indicas correo, debe ser válido. Puedes dejarlo vacío y enviar acceso al portal después desde la ficha del socio.',
      })
      return
    }
    setSubmitting(true)
    try {
      const res = await createUser({
        name: name.trim() || undefined,
        phone: phone.trim(),
        email: emailVal || undefined,
        pin: pin.trim() || undefined,
        role: 'MEMBER',
        ...(profilePictureUrl.trim() && { profile_picture_url: profilePictureUrl.trim() }),
      })
      const msg = (res as { member_login_enabled?: boolean }).member_login_enabled
        ? 'Socio registrado. QR por WhatsApp y credenciales de portal por correo.'
        : 'Socio registrado. Se enviará mensaje de bienvenida si está configurado.'
      notifySuccess({ title: 'Socio registrado', description: msg })
      navigate('/reception', { replace: true })
    } catch (e) {
      notifyError({
        title: 'Error al registrar',
        description: (e as Error)?.message ?? 'Revisa permisos (solo Admin puede dar de alta en algunos entornos).',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-6rem)] bg-background text-foreground flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 sm:p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Registrar socio
          </h1>
        </div>
        <p className="text-sm text-zinc-500 mb-4">
          {hasPortal
            ? 'Alta de socio. Teléfono obligatorio. Correo opcional: si lo indicas, recibirá credenciales del portal por correo; si no (o no quiere participar), podrás enviarle acceso después desde la ficha del socio.'
            : 'Alta rápida de nuevo miembro. Teléfono obligatorio. Email opcional para portal y promociones (si tu plan lo incluye).'}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
              placeholder="Ej. Juan Pérez"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Teléfono *</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
              required
              placeholder="+52 55 1234 5678"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Email (opcional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
              placeholder="ejemplo@correo.com"
              autoComplete="email"
            />
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {hasPortal
                ? 'Si lo indicas, recibirá credenciales del portal por correo. Si no (ej. no quiere o no usa correo), podrás enviarle acceso después desde Socios → Editar socio → Enviar acceso al portal.'
                : 'Para portal (gamificación) y promociones. Recibirá credenciales por correo.'}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">PIN (opcional)</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="w-full rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
              placeholder="4 dígitos"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-zinc-500">Foto de perfil (opcional)</label>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={handleFileChange}
                disabled={uploadingPhoto}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="inline-flex items-center gap-1.5"
              >
                <Camera className="h-3.5 w-3.5" />
                {uploadingPhoto ? 'Subiendo...' : 'Cámara o archivo'}
              </Button>
              <span className="text-[11px] text-zinc-500">o</span>
              <input
                type="url"
                value={profilePictureUrl}
                onChange={(e) => setProfilePictureUrl(e.target.value)}
                className="flex-1 min-w-0 rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                placeholder="Pegar URL de foto"
              />
            </div>
            {profilePictureUrl && (
              <div className="flex items-center gap-2">
                <img
                  src={profilePictureUrl}
                  alt="Vista previa"
                  className="h-12 w-12 rounded-full object-cover border border-zinc-200 dark:border-white/10"
                />
                <button
                  type="button"
                  onClick={() => setProfilePictureUrl('')}
                  className="text-[11px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                >
                  Quitar foto
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => navigate('/reception/members')} className="flex-1">
              Volver
            </Button>
            <Button type="submit" disabled={submitting} className="flex-1">
              {submitting ? 'Guardando...' : 'Registrar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
