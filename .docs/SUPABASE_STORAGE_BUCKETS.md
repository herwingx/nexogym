# Buckets de Supabase Storage

Este documento describe la configuración de los buckets de Supabase Storage usados por NexoGym. **Deben crearse manualmente** en el Dashboard de Supabase para cada proyecto (dev, staging, prod).

---

## Buckets requeridos

| Bucket              | Uso                                  | Dónde se usa en la app                    |
|---------------------|--------------------------------------|-------------------------------------------|
| `gym-logos`         | Logos de gimnasios (white-label)     | Super Admin → Crear gimnasio / Editar gym |
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

Por defecto, Supabase bloquea operaciones sin políticas. Debes crear **políticas de INSERT** para permitir que usuarios autenticados suban archivos.

### Política para `gym-logos`

1. En **Storage** → **Policies**, selecciona el bucket `gym-logos`.
2. Pulsa **New policy**.
3. Usa una política personalizada (o la plantilla "Give users access to a folder only to authenticated users" y adapta):

| Campo               | Valor |
|---------------------|-------|
| **Policy name**     | `Allow authenticated uploads to gym-logos` |
| **Allowed operation** | Marcar **INSERT** (y **SELECT** si quieres permitir lectura explícita) |
| **Target roles**    | `authenticated` |
| **Policy definition** | `bucket_id = 'gym-logos' AND auth.role() = 'authenticated'` |

El código sube archivos directamente a la raíz del bucket (p. ej. `uuid.jpg`), **no** a subcarpetas. No uses condiciones como `(storage.foldername(name))[1] = 'private'` porque bloquearían las subidas.

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

Supabase genera algo como:

```sql
CREATE POLICY "Allow authenticated uploads to gym-logos_xxx"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'gym-logos' AND auth.role() = 'authenticated');
```

---

## Dónde está en el código

| Bucket              | Archivo                     | Función/Uso                            |
|---------------------|-----------------------------|----------------------------------------|
| `gym-logos`         | `SuperAdminDashboard.tsx`   | Crear gym: `handleCreateGymLogoUpload`; Editar gym: `handleEditGymLogoUpload` |
| `profile-pictures`  | `ReceptionMemberNew.tsx`    | Subir foto en formulario de alta de socio |

El cliente usa `supabase.storage.from(BUCKET).upload(path, file)` y luego `getPublicUrl(path)` para obtener la URL que se guarda en la base de datos.

---

## Errores frecuentes

| Error                 | Causa                  | Solución                                           |
|-----------------------|------------------------|----------------------------------------------------|
| **Bucket not found**  | El bucket no existe    | Crear el bucket en Storage con el nombre exacto    |
| **new row violates row-level security policy** | No hay política de INSERT | Añadir la política de `INSERT` para `authenticated` |
| **403 / Forbidden**   | Política demasiado restrictiva (p. ej. carpeta `private`) | Usar solo `bucket_id = '...' AND auth.role() = 'authenticated'` |

---

## Checklist de setup (por entorno)

- [ ] Bucket `gym-logos` creado, público, límite 10 MB
- [ ] Política INSERT (authenticated) en `gym-logos`
- [ ] Bucket `profile-pictures` creado, público, límite 10 MB
- [ ] Política INSERT (authenticated) en `profile-pictures`

Repetir en cada proyecto Supabase (dev, staging, prod).
