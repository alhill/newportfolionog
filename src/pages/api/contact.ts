import type { APIRoute } from 'astro';
import { checkRateLimit, getRemainingRequests } from '../../lib/rate-limit';
import { Resend } from 'resend';

interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
  captcha_token: string;
  honeypot: string; // Should be empty
}

const resend = new Resend(import.meta.env.RESEND_API_KEY);

// Verify Turnstile token with Cloudflare
async function verifyTurnstileToken(token: string): Promise<boolean> {
  if (!import.meta.env.CLOUDFLARE_TURNSTILE_SECRET_KEY) {
    console.warn('CLOUDFLARE_TURNSTILE_SECRET_KEY not configured');
    return true; // Skip verification if not configured
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: import.meta.env.CLOUDFLARE_TURNSTILE_SECRET_KEY,
        response: token,
      }),
    });

    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return false;
  }
}

export const POST: APIRoute = async (context) => {
  try {
    // Get client IP for rate limiting
    const ip = context.clientAddress || 'unknown';

    // Check rate limit
    if (!checkRateLimit(ip)) {
      const remaining = getRemainingRequests(ip);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Demasiadas solicitudes. Intenta de nuevo más tarde.',
          retryAfter: 15 * 60,
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body
    const body = await context.request.json() as ContactFormData;

    // Validate required fields
    if (!body.name || !body.email || !body.subject || !body.message) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Campos requeridos no rellenados',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Honeypot check: honeypot field should be empty
    if (body.honeypot && body.honeypot.trim() !== '') {
      console.warn('Honeypot triggered from IP:', ip);
      // Return success to avoid revealing the honeypot
      return new Response(
        JSON.stringify({ success: true, message: '¡Mensaje enviado con éxito!' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify Turnstile captcha
    const captchaValid = await verifyTurnstileToken(body.captcha_token);
    if (!captchaValid) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Verificación de captcha fallida. Intenta de nuevo.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Dirección de email inválida',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Clean and sanitize inputs
    const name = body.name.trim().substring(0, 200);
    const email = body.email.trim().toLowerCase();
    const subject = body.subject.trim().substring(0, 200);
    const message = body.message.trim().substring(0, 5000);

    // Send email using Resend
    const result = await resend.emails.send({
      from: import.meta.env.RESEND_FROM_EMAIL || 'noreply@srtanognog.com',
      to: import.meta.env.RESEND_TO_EMAIL || 'srtanognog@gmail.com',
      replyTo: email,
      subject: `Nuevo mensaje de contacto: ${subject}`,
      html: `
        <h2>Nuevo mensaje de contacto</h2>
        <p><strong>Nombre:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Asunto:</strong> ${escapeHtml(subject)}</p>
        <hr />
        <h3>Mensaje:</h3>
        <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
      `,
    });

    if (result.error) {
      console.error('Resend error:', result.error);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Error al enviar el email. Intenta de nuevo más tarde.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: '¡Mensaje enviado con éxito! Me pondré en contacto contigo lo antes posible.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Contact form error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Ocurrió un error inesperado. Intenta de nuevo más tarde.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}
