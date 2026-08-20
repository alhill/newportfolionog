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

Copia `.env.example` a `.env` (o `.env.local`). Hay dos grupos:

### Build time (`PUBLIC_*`)

También se pueden definir en **Cloud Run → Variables de entorno** (no en Secret Manager). El servidor las inyecta en cada página HTML, así que el admin y Turnstile funcionan sin depender solo del build.

En local, `deploy:cloudrun` sigue pasando las `PUBLIC_*` de tu `.env` a Cloud Build como respaldo.

- `PUBLIC_FIREBASE_*`
- `PUBLIC_CLOUDFLARE_TURNSTILE_SITEKEY`

### Runtime (secretos de servidor)

Se leen con `process.env` al arrancar el contenedor. Configúralas en **Cloud Run → servicio `portfolio` → Edit & deploy → Variables & secrets** (o Secret Manager).

- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_TO_EMAIL`
- `CLOUDFLARE_TURNSTILE_SECRET_KEY`
- `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_KV_NAMESPACE_ID`
- `R2_*` (si usas R2)
- `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET` (opcional en Cloud Run si el proyecto GCP coincide)

En Cloud Run, Firebase Admin usa **Application Default Credentials** del service account del servicio. Solo necesitas `FIREBASE_SERVICE_ACCOUNT` en local.

Para el snapshot de redirecciones (build-time) en local:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT` (JSON string) o credenciales ADC en GCP

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

### 1. Secretos en Cloud Run (una vez)

Consola: **Cloud Run → portfolio → Edit & deploy new revision → Variables & secrets**

Añade las variables de runtime listadas arriba (o referencias a Secret Manager).

**Importante:** las `PUBLIC_FIREBASE_*` y `PUBLIC_CLOUDFLARE_TURNSTILE_SITEKEY` van como **variables de entorno normales** en Cloud Run (no como secrets). El admin las necesita en runtime.

Ejemplo por CLI:

```bash
gcloud run services update portfolio \
  --region europe-west1 \
  --set-env-vars="PUBLIC_FIREBASE_API_KEY=xxx,PUBLIC_FIREBASE_AUTH_DOMAIN=portfolio-nog.firebaseapp.com,PUBLIC_FIREBASE_PROJECT_ID=portfolio-nog,PUBLIC_FIREBASE_STORAGE_BUCKET=portfolio-nog.firebasestorage.app,PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxx,PUBLIC_FIREBASE_APP_ID=xxx,PUBLIC_CLOUDFLARE_TURNSTILE_SITEKEY=xxx,RESEND_FROM_EMAIL=no-responder@tudominio.com,RESEND_TO_EMAIL=tu@email.com,FIREBASE_PROJECT_ID=portfolio-nog,FIREBASE_STORAGE_BUCKET=portfolio-nog.firebasestorage.app,CLOUDFLARE_ACCOUNT_ID=...,CLOUDFLARE_KV_NAMESPACE_ID=..."
```

### 2. Desplegar

Con tu `.env` local (solo para las `PUBLIC_*` del build):

```bash
bun run deploy:cloudrun
```

El script pasa automáticamente las `PUBLIC_*` a Cloud Build y despliega el servicio. Los secretos de servidor **no** se suben: deben estar ya en Cloud Run.

Variables opcionales del script:

- `CLOUD_RUN_REGION` (default: `europe-west1`)
- `CLOUD_RUN_SERVICE` (default: `portfolio`)

## Troubleshooting rapido

- Si `snapshot:redirections` no actualiza datos:
	- Revisa credenciales Firebase Admin y `FIREBASE_PROJECT_ID`.
- Si el deploy no refleja cambios:
	- Asegurate de haber regenerado snapshot y de desplegar desde el mismo estado local.
- Si solo quieres verificar redirecciones en runtime:
	- Comprueba el contenido de `src/generated/redirections.snapshot.json` tras ejecutar snapshot/build.
