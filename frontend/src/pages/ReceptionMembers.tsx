import { useState, useRef, useEffect } from 'react'
import { Search, User, Camera } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { searchMembers, updateMember, sendQrToMember, regenerateQr, type MemberSummary } from '../lib/apiClient'
import { notifyError, notifySuccess } from '../lib/notifications'
import { supabase } from '../lib/supabaseClient'
import { useAuthStore } from '../store/useAuthStore'

const PROFILE_BUCKET = 'profile-pictures'

export const ReceptionMembersPage = () => {
  const userRole = useAuthStore((s) => s.user?.role)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MemberSummary[]>([])
  const [searching, setSearching] = useState(false)
  const [editMember, setEditMember] = useState<MemberSummary | null>(null)
  const canRegenerateQr = userRole === 'ADMIN' || userRole === 'SUPERADMIN'

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await searchMembers(query)
        setResults(data)
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  return (
    <div className="min-h-[calc(100vh-6rem)] bg-background text-foreground px-4 py-6">
      <div className="mx-auto max-w-xl space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Buscar socio
          </h1>
          <p className="text-sm text-zinc-500">
            Editar nombre, teléfono o foto. Útil para agregar foto desde el celular si el alta se hizo en PC sin cámara.
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nombre o teléfono (mín. 2 caracteres)"
            className="w-full rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 py-2.5 pl-10 pr-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
          />
        </div>
        {searching && <p className="text-xs text-zinc-500">Buscando...</p>}
        {!searching && query.trim().length >= 2 && (
          <ul className="space-y-1 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 overflow-hidden">
            {results.length === 0 ? (
              <li className="px-4 py-3 text-sm text-zinc-500">Sin resultados</li>
            ) : (
              results.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setEditMember(m)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    {m.profile_picture_url ? (
                      <img
                        src={m.profile_picture_url}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover border border-zinc-200 dark:border-white/10"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                        <User className="h-5 w-5 text-zinc-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                        {m.name || 'Sin nombre'}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">{m.phone}</p>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      {editMember && (
        <Modal isOpen title="Editar socio" onClose={() => setEditMember(null)}>
          <EditMemberForm
            member={editMember}
            onSuccess={() => setEditMember(null)}
            onCancel={() => setEditMember(null)}
            canRegenerateQr={canRegenerateQr}
          />
        </Modal>
      )}
    </div>
  )
}

function EditMemberForm({
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
  const [name, setName] = useState(member.name ?? '')
  const [phone, setPhone] = useState(member.phone)
  const [profilePictureUrl, setProfilePictureUrl] = useState(member.profile_picture_url ?? '')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [sendingQr, setSendingQr] = useState(false)
  const [regeneratingQr, setRegeneratingQr] = useState(false)

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
      notifyError({ title: 'Error', description: (e as Error)?.message })
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
            className="inline-flex items-center gap-1.5"
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
    </form>
  )
}
