## Modulo de facturas

Este modulo ya no depende de Google Drive ni de Google Sheets.

Ahora trabaja sobre Supabase con este flujo:

1. Crear registros `pendiente` por persona.
2. Seleccionar uno o varios pendientes.
3. Cargar la foto de la factura.
4. Leer el numero por OCR desde una zona fija.
5. Guardar la imagen en `invoice-photos`.
6. Marcar los registros como `listo`.
7. Exportar el mes en un ZIP con:
   - `reporte_facturas_YYYY-MM.xlsx`
   - `fotos_facturas_YYYY-MM/`

Archivos principales:

- `modules/invoices/invoice-module.js`
- `modules/invoices/invoice-module.css`
- `supabase-service.js`
- `supabase/schema.sql`

La configuracion compartida del modulo se guarda en `invoice_settings`:

- carpeta base en Storage
- coordenadas del recorte OCR
