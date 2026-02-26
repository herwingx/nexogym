import { useRef, useState } from 'react'
import { Camera, Mail } from 'lucide-react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import {
  updateMember,
  sendQrToMember,
  sendPortalAccess,
  regenerateQr,
  type MemberSummary,
} from '../../lib/apiClient'
import { notifyError, notifySuccess } from '../../lib/notifications'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/useAuthStore'

const PROFILE_BUCKET = 'profile-pictures'
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function EditMemberForm({
  member,
  onSuccess,
  onCancel,
  canRegenerateQr = false,
}: {
  member: MemberSummary
  onSuccess: () => void
  onCancel: () => void
  canRegenerateQr?: boolean
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hasPortal = useAuthStore((s) => s.modulesConfig.qr_access)
  const hasPortalAccess = Boolean(member.auth_user_id)
  const [name, setName] = useState(member.name ?? '')
  const [phone, setPhone] = useState(member.phone)
  const [profilePictureUrl, setProfilePictureUrl] = useState(member.profile_picture_url ?? '')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [sendingQr, setSendingQr] = useState(false)
  const [regeneratingQr, setRegeneratingQr] = useState(false)
  const [portalModalOpen, setPortalModalOpen] = useState(false)
  const [portalEmail, setPortalEmail] = useState('')
  const [sendingPortal, setSendingPortal] = useState(false)

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
      notifySuccess({ title: 'Foto lista' })
    } catch (err) {
      notifyError({
        title: 'No se pudo subir la foto',
        description: (err as Error)?.message ?? '',
      })
    } finally {
      setUploadingPhoto(false)
      e.target.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await updateMember(member.id, {
        name: name.trim() || undefined,
        phone: phone.trim(),
        ...(profilePictureUrl.trim() && { profile_picture_url: profilePictureUrl.trim() }),
      })
      notifySuccess({ title: 'Socio actualizado' })
      onSuccess()
    } catch (e) {
      notifyError({ title: 'Error', description: (e as Error)?.message ?? '' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">Nombre</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">Teléfono</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
          required
        />
      </div>
      <div className="space-y-2">
        <label className="block text-xs font-medium text-zinc-500">Foto de perfil</label>
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
            className="inline-flex gap-1.5"
          >
            <Camera className="h-3.5 w-3.5" />
            {uploadingPhoto ? 'Subiendo...' : 'Cámara o archivo'}
          </Button>
          <input
            type="url"
            value={profilePictureUrl}
            onChange={(e) => setProfilePictureUrl(e.target.value)}
            className="flex-1 min-w-0 rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
            placeholder="URL de foto"
          />
        </div>
        {profilePictureUrl && (
          <div className="flex items-center gap-2 mt-1">
            <img
              src={profilePictureUrl}
              alt="Vista previa"
              className="h-12 w-12 rounded-full object-cover border border-zinc-200 dark:border-white/10"
            />
            <button type="button" onClick={() => setProfilePictureUrl('')} className="text-xs text-zinc-500 hover:text-zinc-700">
              Quitar foto
            </button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2 justify-between items-center border-t border-zinc-200 dark:border-white/10 mt-4 pt-4">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={async () => {
              if (sendingQr) return
              setSendingQr(true)
              try {
                await sendQrToMember(member.id)
                notifySuccess({
                  title: 'QR enviado',
                  description: 'Si el gym tiene WhatsApp configurado, el socio lo recibirá en unos segundos.',
                })
              } catch (e) {
                notifyError({ title: 'No se pudo enviar', description: (e as Error)?.message ?? '' })
              } finally {
                setSendingQr(false)
              }
            }}
            disabled={sendingQr || !phone?.trim()}
            className="inline-flex gap-1.5"
          >
            {sendingQr ? 'Enviando...' : 'Reenviar QR por WhatsApp'}
          </Button>
          {hasPortal && !hasPortalAccess && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setPortalEmail('')
                setPortalModalOpen(true)
              }}
              className="inline-flex gap-1.5 text-emerald-600 hover:text-emerald-700 border-emerald-300 hover:border-emerald-400"
            >
              <Mail className="h-3.5 w-3.5" />
              Enviar acceso al portal
            </Button>
          )}
          {canRegenerateQr && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                if (regeneratingQr) return
                setRegeneratingQr(true)
                try {
                  await regenerateQr(member.id, !!phone?.trim())
                  notifySuccess({
                    title: 'QR regenerado',
                    description: 'El código anterior ya no funciona. El socio recibirá el nuevo por WhatsApp si tiene teléfono.',
                  })
                  onSuccess()
                } catch (e) {
                  notifyError({ title: 'Error', description: (e as Error)?.message ?? '' })
                } finally {
                  setRegeneratingQr(false)
                }
              }}
              disabled={regeneratingQr}
              className="inline-flex gap-1.5 text-amber-600 hover:text-amber-700 border-amber-300 hover:border-amber-400"
            >
              {regeneratingQr ? 'Regenerando...' : 'Regenerar QR'}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" disabled={submitting}>{submitting ? 'Guardando...' : 'Guardar'}</Button>
        </div>
      </div>

      <Modal
        isOpen={portalModalOpen}
        onClose={() => !sendingPortal && setPortalModalOpen(false)}
        title="Enviar acceso al portal"
        description="Indica el correo del socio. Recibirá credenciales temporales y deberá cambiar la contraseña en el primer inicio de sesión. Si olvida la contraseña, puede usar «Olvidé mi contraseña» en el login."
      >
        <div className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Correo del socio</label>
            <input
              type="email"
              value={portalEmail}
              onChange={(e) => setPortalEmail(e.target.value)}
              placeholder="socio@ejemplo.com"
              className="w-full rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              autoFocus
              disabled={sendingPortal}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPortalModalOpen(false)}
              disabled={sendingPortal}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={async () => {
                const email = portalEmail.trim()
                if (!email || !EMAIL_REGEX.test(email)) {
                  notifyError({ title: 'Correo inválido', description: 'Indica un correo válido.' })
                  return
                }
                setSendingPortal(true)
                try {
                  await sendPortalAccess(member.id, email)
                  notifySuccess({
                    title: 'Credenciales enviadas',
                    description: 'El socio recibirá un correo con usuario y contraseña temporal. Debe cambiar la contraseña en el primer inicio de sesión.',
                  })
                  setPortalModalOpen(false)
                  onSuccess()
                } catch (e) {
                  notifyError({ title: 'Error', description: (e as Error)?.message ?? '' })
                } finally {
                  setSendingPortal(false)
                }
              }}
              disabled={sendingPortal || !EMAIL_REGEX.test(portalEmail.trim())}
            >
              {sendingPortal ? 'Enviando...' : 'Enviar'}
            </Button>
          </div>
        </div>
      </Modal>
    </form>
  )
}
