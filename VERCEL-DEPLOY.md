# Deployment a Vercel

## Opción 1: Mediante GitHub (Recomendado)

1. Inicializa Git en esta carpeta:
```powershell
cd "c:\Users\Hoyo 20 Server\Documents\proyectos de mojoras"
git init
git add .
git commit -m "Initial commit"
```

2. Crea un repo en GitHub y haz push
3. En https://vercel.com/new, importa el repositorio de GitHub
4. ¡Vercel auto-desplegará!

## Opción 2: Mediante el Dashboard de Vercel (Sin Git)

1. Ve a https://vercel.com
2. Inicia sesión o crea cuenta
3. Haz clic en "Add New..." → "Project"
4. Selecciona "Deploy from folder" o arrastra cualquier carpeta
5. Configura:
   - **Framework**: None (Static)
   - **Build Command**: Empty
   - **Output Directory**: ./
6. Haz clic en "Deploy"

## Opción 3: Mediante Vercel CLI

```powershell
# 1. Instala Vercel (si falta node, instala desde https://nodejs.org)
npm install -g vercel

# 2. Deploy
cd "c:\Users\Hoyo 20 Server\Documents\proyectos de mojoras"
vercel --prod
```

## No olvides

- Actualizar `supabase-config.js` con tu URL de Supabase
- El frontend está listo para consumir Supabase desde cualquier origen

## URL de tu Supabase:
```
https://tkbmzjlubpkmtlskjind.supabase.co
```

Ya está configurado en `supabase-config.js`
