## Despliegue del frontend

Supabase queda como backend principal del sistema y la publicacion del frontend se hace con la Edge Function `portal`.

Contexto importante:

- Supabase Storage no sirve HTML ejecutable como sitio web general.
- La funcion `portal` publica la app usando XML + XSLT para que el navegador renderice la interfaz desde un link de Supabase.

URL de produccion:

- `https://tkbmzjlubpkmtlskjind.functions.supabase.co/portal/`

Archivos que alimentan la publicacion:

- `index.html`
- `styles.css`
- `app.js`
- `supabase-config.js`
- `supabase-service.js`
- `vendor/`
- `modules/`
- `assets/`

Scripts disponibles:

- `supabase/build-edge-assets.ps1`
- `supabase/deploy-portal.ps1`

Para republicar:

```powershell
powershell -ExecutionPolicy Bypass -File .\supabase\deploy-portal.ps1
```

Lo importante es que la data ya no vive en la PC del navegador: vive en Supabase y la interfaz queda accesible desde un enlace publico del proyecto.
