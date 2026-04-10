## Supabase setup

Este proyecto usa Supabase para:

- autenticacion con email y clave
- datos compartidos de incidencias, solicitudes y consumibles
- auditoria de cambios
- modulo de facturas
- almacenamiento de fotos de facturas

### 1. Crear la estructura

En el SQL Editor del proyecto ejecuta:

- `supabase/schema.sql`

### 2. Crear usuarios

En `Authentication > Users` crea los usuarios internos que tendran acceso.

### 3. Publicar el frontend

La aplicacion ya esta lista para consumir Supabase desde archivos estaticos:

- `index.html`
- `styles.css`
- `app.js`
- `supabase-config.js`
- `supabase-service.js`
- `vendor/`
- `modules/`

El backend queda en Supabase. El frontend puede servirse desde cualquier hosting estatico o desde un servidor interno.

Tambien quedaron preparados estos scripts:

- `supabase/apply-remote.ps1`
  Aplica login CLI, link y `db push` remoto.
- `supabase/publish-frontend.ps1`
  Sube el frontend a un bucket publico `frontend` en Supabase Storage.

### 4. Facturas

Tabla principal:

- `invoice_entries`

Campos de exportacion mensual:

- `Fecha`
- `No. Factura`
- `Nombre`
- `Horas`
- `Estado`
- `comentario`

Bucket privado:

- `invoice-photos`

Bucket publico para frontend:

- `frontend`

### 5. Auditoria

Cada guardado del bloque principal se registra en:

- `audit_log`

Y cada fila de facturas guarda:

- `created_by`
- `created_by_email`
- `updated_by`
- `updated_by_email`
