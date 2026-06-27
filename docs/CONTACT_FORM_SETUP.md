# Guía de Configuración - Formulario de Contacto

## Requisitos Implementados

✅ Layout de dos columnas (formulario + imagen)  
✅ Validación de formulario en cliente y servidor  
✅ Honeypot anti-bots  
✅ Rate limiting (5 requests por 15 minutos)  
✅ Captcha con Cloudflare Turnstile  
✅ Envío de emails con Resend  

## Configuración Paso a Paso

### 1. Configurar Resend (Envío de Emails)

#### Obtener API Key:
1. Ve a [Resend.com](https://resend.com)
2. Crea una cuenta o inicia sesión
3. Ve a la sección de API Keys
4. Copia tu API Key

#### Configurar en tu proyecto:
1. Copia `.env.example` a `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Abre `.env.local` y actualiza:
   ```
   RESEND_API_KEY=re_xxxxxxxxx (tu API key)
   RESEND_FROM_EMAIL=noreply@srtanognog.com (o el email que uses)
   RESEND_TO_EMAIL=srtanognog@gmail.com (donde recibirás los mensajes)
   ```

**Nota:** El `RESEND_FROM_EMAIL` debe ser:
- Un email verificado en tu cuenta Resend, o
- Un subdomain personalizado que hayas configurado

### 2. Configurar Cloudflare Turnstile (Captcha)

#### Obtener claves:
1. Ve a [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Inicia sesión con tu cuenta de Cloudflare
3. Ve a **Turnstile** en la barra lateral
4. Haz click en **Create Site**
5. Rellena el formulario:
   - **Domain:** srtanognog.com (o tu dominio)
   - **Mode:** Challenge (recomendado) o Managed (más flexible)
6. Copia las claves

#### Configurar en tu proyecto:
Actualiza `.env.local`:
```
PUBLIC_CLOUDFLARE_TURNSTILE_SITEKEY=xxxxxxxxx (Site Key)
CLOUDFLARE_TURNSTILE_SECRET_KEY=yyyyyyyyy (Secret Key)
```

**Nota:** Las variables con `PUBLIC_` son accesibles desde el cliente (es seguro), las otras solo desde el servidor.

### 3. Probar Localmente

```bash
npm run dev
```

Visita `http://localhost:3000/contacto` y prueba el formulario.

**Durante desarrollo:**
- Si no tienes las claves configuradas, el captcha se saltará automáticamente
- El rate limiting funciona por IP del cliente

## Características de Seguridad

### Rate Limiting
- **Límite:** 5 requests por dirección IP cada 15 minutos
- **Respuesta:** HTTP 429 si se excede
- **Mensaje:** "Too many requests. Please try again later."

### Honeypot
- Campo oculto `honeypot` que los bots típicamente rellenan
- Si está relleno, se devuelve éxito para no revelar el honeypot
- El email NO se envía

### Validación
- Email válido (validación regex)
- Captcha verificado con Cloudflare
- Campos requeridos
- Sanitización de HTML (XSS protection)
- Límite de longitud en campos

## Manejo de Errores

El formulario muestra mensajes claros:
- ✅ Éxito: "Message sent successfully! I will get back to you as soon as possible."
- ❌ Error: Mensaje específico del error
- 🛑 Rate limit: "Too many requests. Please try again later."

## Variables de Entorno

```
# Requeridas
RESEND_API_KEY=              # Tu API key de Resend
PUBLIC_CLOUDFLARE_TURNSTILE_SITEKEY=  # Si key del Turnstile

# Opcionales (tienen valores por defecto)
RESEND_FROM_EMAIL=noreply@srtanognog.com
RESEND_TO_EMAIL=srtanognog@gmail.com
CLOUDFLARE_TURNSTILE_SECRET_KEY=    # Secret key del Turnstile
```

## Archivos Creados/Modificados

- ✨ [src/pages/api/contact.ts](src/pages/api/contact.ts) - Endpoint POST
- ✨ [src/lib/rate-limit.ts](src/lib/rate-limit.ts) - Sistema de rate limiting
- 🔄 [src/pages/contacto.astro](src/pages/contacto.astro) - Página actualizada
- 📄 [.env.example](.env.example) - Template de variables

## Propósitos de Cada Componente

### Endpoint `/api/contact`
- Valida el captcha con Cloudflare
- Comprueba el honeypot
- Verifica rate limit
- Valida el email
- Sanitiza inputs
- Envía email con Resend

### Rate Limiting
- Almacenamiento en memoria (reinicia con el servidor)
- 5 requests por IP cada 15 minutos
- Perfecto para DEV, puede mejorarse con Redis para producción

### Honeypot
- Campo oculto en el HTML
- Los bots lo rellenan automáticamente
- Es silencioso (devuelve success para no revelar el truco)

### Seguridad
- HTTPS recomendado en producción
- Validación doble (cliente + servidor)
- Protección contra XSS con escaping de HTML
- Límites en longitud de campos

## Notas de Producción

1. **Rate Limiting Mejorado:** Considera usar Redis para distribuir entre instancias
2. **HTTPS Obligatorio:** El captcha de Turnstile requiere HTTPS
3. **Monitoreo:** Añade logs para rastrear intentos sospechosos
4. **Backups:** Asegúrate de tener copias de los emails en Resend
5. **Emails Bounce:** Configura manejadores de bounce en Resend

## Troubleshooting

### El captcha no aparece
- Verifica que `PUBLIC_CLOUDFLARE_TURNSTILE_SITEKEY` esté configurado
- Asegúrate de usar HTTPS en producción
- Revisa la consola del navegador para errores

### Los emails no se envían
- Verifica que `RESEND_API_KEY` sea válido
- Comprueba que el `RESEND_FROM_EMAIL` esté verificado en Resend
- Revisa los logs del servidor para errores

### Rate limit muy restrictivo
- Cambia `MAX_REQUESTS` o `WINDOW_MS` en [src/lib/rate-limit.ts](src/lib/rate-limit.ts)
- En producción, usa Redis para persistencia

---

¡Listo! Tu página de contacto está completamente funcional y segura. 🎉
