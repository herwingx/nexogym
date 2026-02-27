# Buckets de Supabase Storage

Este documento describe la configuración de los buckets de Supabase Storage usados por NexoGym. **Deben crearse manualmente** en el Dashboard de Supabase para cada proyecto (dev, staging, prod).

---

## Buckets requeridos

| Bucket              | Uso                                  | Dónde se usa en la app                    |
|---------------------|--------------------------------------|-------------------------------------------|
| `gym-logos`         | Logos de gimnasios (white-label)     | Super Admin → Crear/Editar gym; **Admin** → Mi perfil |
| `profile-pictures`  | Fotos de perfil de socios            | Recepción → Registrar socio               |

Si el bucket no existe, las subidas fallan con **"Bucket not found"** (400). En ese caso el usuario puede usar solo la URL manual (pegar un enlace externo), pero la subida desde el dispositivo no funcionará.

---

## Crear los buckets

1. Entra al **Dashboard de Supabase** del proyecto.
2. Ve a **Storage** en el menú lateral.
3. Pulsa **New bucket**.
4. Crea ambos buckets con esta configuración:

| Opción           | Valor        |
|------------------|--------------|
| **Name**         | `gym-logos` o `profile-pictures` |
| **Public bucket**| Activado (para que `getPublicUrl` devuelva URLs accesibles) |
| **File size limit** | 10 MB (recomendado) |
| **Allowed MIME types** | `image/jpeg`, `image/png`, `image/webp` (o "Any" si prefieres) |

---

## Políticas (Storage Policies)

Por defecto, Supabase bloquea operaciones sin políticas. Debes crear políticas para permitir que usuarios autenticados suban, lean y eliminen archivos.

**Opción rápida:** Ejecuta el siguiente SQL en **Supabase Dashboard → SQL Editor**. Crea las políticas mínimas para `profile-pictures` (INSERT) y `gym-logos` (INSERT, DELETE). Si prefieres configurar por UI, sigue las secciones siguientes.

```sql
-- Bucket profile-pictures (fotos de socios)
DROP POLICY IF EXISTS "nexogym_profile_pictures_insert" ON storage.objects;
CREATE POLICY "nexogym_profile_pictures_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'profile-pictures');

-- Bucket gym-logos (logos de gimnasios)
DROP POLICY IF EXISTS "nexogym_gym_logos_insert" ON storage.objects;
CREATE POLICY "nexogym_gym_logos_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'gym-logos');

DROP POLICY IF EXISTS "nexogym_gym_logos_delete" ON storage.objects;
CREATE POLICY "nexogym_gym_logos_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'gym-logos');
```

### Política para `gym-logos`

1. En **Storage** → **Policies**, selecciona el bucket `gym-logos`.
2. Pulsa **New policy**.
3. Configura:

| Campo               | Valor |
|---------------------|-------|
| **Policy name**     | `Authenticated gym-logos access` (o similar) |
| **Allowed operation** | Marcar **SELECT**, **INSERT** y **DELETE** |
| **Target roles**    | `authenticated` |
| **Policy definition** | `bucket_id = 'gym-logos' AND auth.role() = 'authenticated'` |

**Importante:** Los logos se guardan en la **raíz** del bucket (p. ej. `a1b2c3d4-uuid.jpg`), sin subcarpetas. **No** uses condiciones de carpeta como `(storage.foldername(name))[1] = 'private'` porque bloquearían las operaciones.

- **INSERT:** subir nuevos logos (Admin en Mi perfil, SuperAdmin al crear/editar gym).
- **DELETE:** eliminar el logo anterior al subir uno nuevo o al quitarlo (evita archivos huérfanos).

### Política para `profile-pictures`

Misma configuración cambiando el bucket:

| Campo               | Valor |
|---------------------|-------|
| **Policy name**     | `Allow authenticated uploads to profile-pictures` |
| **Allowed operation** | **INSERT** (y **SELECT** si aplica) |
| **Target roles**    | `authenticated` |
| **Policy definition** | `bucket_id = 'profile-pictures' AND auth.role() = 'authenticated'` |

---

## SQL generado (referencia)

Para `gym-logos` con SELECT, INSERT y DELETE, Supabase crea políticas que incluyen la condición:

```sql
bucket_id = 'gym-logos' AND auth.role() = 'authenticated'
```

Cada operación (INSERT, DELETE, SELECT) puede tener su propia política o una única política con varias operaciones, según la UI.

---

## Dónde está en el código

| Bucket              | Archivo                     | Función/Uso                            |
|---------------------|-----------------------------|----------------------------------------|
| `gym-logos`         | `SuperAdminDashboard.tsx`, `ProfileSettings.tsx` | SuperAdmin: crear/editar gym; Admin: subir/quitar logo en Mi perfil. Se elimina el logo anterior al subir uno nuevo. |
| `profile-pictures`  | `ReceptionMemberNew.tsx`    | Subir foto en formulario de alta de socio |

El cliente usa `supabase.storage.from(BUCKET).upload(path, file)` y luego `getPublicUrl(path)` para obtener la URL que se guarda en la base de datos.

---

## Errores frecuentes

| Error                 | Causa                  | Solución                                           |
|-----------------------|------------------------|----------------------------------------------------|
| **Bucket not found**  | El bucket no existe    | Crear el bucket en Storage con el nombre exacto    |
| **new row violates row-level security policy** | No hay política de INSERT | Añadir la política de `INSERT` para `authenticated` |
| **403 / Forbidden**   | Política demasiado restrictiva (p. ej. `(storage.foldername(name))[1] = 'private'`) | Los archivos están en la raíz; usar solo `bucket_id = '...' AND auth.role() = 'authenticated'`. |

---

## Checklist de setup (por entorno)

- [ ] Bucket `gym-logos` creado, público, límite 10 MB
- [ ] Política INSERT y DELETE (authenticated) en `gym-logos`
- [ ] Bucket `profile-pictures` creado, público, límite 10 MB
- [ ] Política INSERT (authenticated) en `profile-pictures`

Repetir en cada proyecto Supabase (dev, staging, prod).
