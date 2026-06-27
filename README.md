# Portfolio Astro + Firebase

Proyecto de portfolio con Astro (SSR), panel admin y backend sobre Firebase.

## Requisitos

- Bun o npm
- Node.js 20+
- gcloud CLI (para despliegue en Cloud Run)
- Variables de entorno configuradas

## Instalacion

```bash
bun install
```

Tambien funciona con npm:

```bash
npm install
```

## Variables de entorno

Usa como base `.env.example` y completa al menos las variables necesarias para tu entorno.

Para el snapshot de redirecciones (build-time) son especialmente relevantes:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT` (JSON string) o `FIREBASE_ADMIN_SDK_KEY`

Para contacto/captcha/email revisa tambien:

- `RESEND_API_KEY`
- `PUBLIC_CLOUDFLARE_TURNSTILE_SITEKEY`
- `CLOUDFLARE_TURNSTILE_SECRET_KEY`

Para integrar Cloudflare KV (p. ej. con otro administrador que comparta el mismo namespace):

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN` (permiso *Workers KV Storage > Edit*)
- `CLOUDFLARE_KV_NAMESPACE_ID`
- `CLOUDFLARE_KV_KEY_PREFIX` (opcional, para prefijar claves en namespaces compartidos)

Uso en servidor:

```ts
import { getKvJson, isKvConfigured, putKvJson } from '../lib/cloudflare-kv';

if (isKvConfigured()) {
  const data = await getKvJson('mi-clave');
  await putKvJson('mi-clave', { ...data, actualizado: true });
}
```

Para Cloudflare R2 (subidas/descargas de archivos vía API S3-compatible):

- `CLOUDFLARE_ACCOUNT_ID` (reutiliza el de KV)
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_OBJECT_KEY_PREFIX` (opcional)
- `R2_PUBLIC_BASE_URL` (opcional, para URLs publicas)

Uso en servidor:

```ts
import { getR2Object, isR2Configured, putR2Object } from '../lib/cloudflare-r2';

if (isR2Configured()) {
  await putR2Object('media/foto.jpg', buffer, { contentType: 'image/jpeg' });
  const file = await getR2Object('media/foto.jpg');
}
```

## Scripts principales

- `bun run dev`: desarrollo local
- `bun run snapshot:redirections`: regenera el snapshot JSON de redirecciones desde Firestore
- `bun run build`: ejecuta snapshot + build de produccion
- `bun run start`: ejecuta la build de produccion desde `dist/server/entry.mjs`
- `bun run preview`: preview de Astro
- `bun run deploy:cloudrun`: despliegue a Cloud Run desde source
- `bun run docker:build`: construye imagen Docker local
- `bun run docker:run`: ejecuta imagen Docker local

## Flujo recomendado (manual)

Si gestionas redirecciones desde el admin y quieres reflejarlas en produccion sin cambiar codigo:

1. Actualiza redirecciones en Firestore.
2. Ejecuta localmente:

```bash
bun run snapshot:redirections
```

3. (Recomendado) valida build completa:

```bash
bun run build
```

4. Despliega:

```bash
bun run deploy:cloudrun
```

Nota: `bun run build` ya incluye `snapshot:redirections`, asi que puedes usar como rutina:

```bash
bun run build && bun run deploy:cloudrun
```

## Ejecutar build de produccion en local

```bash
bun run build
bun run start
```

Opcionalmente puedes fijar host/puerto:

```bash
HOST=0.0.0.0 PORT=8080 bun run start
```

## Diferencia entre build y docker:build

- `build`: compila en tu maquina y genera `dist/`.
- `docker:build`: compila dentro del contenedor segun `Dockerfile` y genera una imagen lista para correr.

Si tu despliegue usa `gcloud run deploy --source .`, normalmente basta con `build + deploy:cloudrun`.

## Docker local

```bash
bun run docker:build
bun run docker:run
```

Esto te permite probar un entorno mas cercano a produccion.

## Despliegue Cloud Run

Script actual:

```bash
bun run deploy:cloudrun
```

Internamente ejecuta:

```bash
gcloud run deploy portfolio --source . --region europe-west1 --allow-unauthenticated
```

## Troubleshooting rapido

- Si `snapshot:redirections` no actualiza datos:
	- Revisa credenciales Firebase Admin y `FIREBASE_PROJECT_ID`.
- Si el deploy no refleja cambios:
	- Asegurate de haber regenerado snapshot y de desplegar desde el mismo estado local.
- Si solo quieres verificar redirecciones en runtime:
	- Comprueba el contenido de `src/generated/redirections.snapshot.json` tras ejecutar snapshot/build.
