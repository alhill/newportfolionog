import type { APIRoute } from 'astro';
import { storage, db } from '../../../lib/firebase-admin';

// POST - Subir archivo a Firebase Storage
export const POST: APIRoute = async ({ request, locals }) => {
  // Verificar autenticación
  if (!locals.user) {
    return new Response(
      JSON.stringify({ success: false, error: 'No autorizado' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const alt = formData.get('alt') as string;

    if (!file) {
      return new Response(
        JSON.stringify({ success: false, error: 'No se proporcionó archivo' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validar tamaño (máximo 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return new Response(
        JSON.stringify({ success: false, error: 'El archivo es demasiado grande (máx 50MB)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

   // Determinar tipo de medio
    let mediaType: 'image' | 'video' | 'pdf' | 'audio' = 'image';
    const mimeType = file.type;
    
    if (mimeType.startsWith('image/')) {
      mediaType = 'image';
    } else if (mimeType.startsWith('video/')) {
      mediaType = 'video';
    } else if (mimeType === 'application/pdf') {
      mediaType = 'pdf';
    } else if (mimeType.startsWith('audio/')) {
      mediaType = 'audio';
    }

    // Generar nombre único para el archivo
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${timestamp}_${safeName}`;
    const filePath = `media/${mediaType}/${fileName}`;

    // Subir a Firebase Storage
    const bucketName = import.meta.env.FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
      return new Response(
        JSON.stringify({ success: false, error: 'Storage bucket no configurado' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const bucket = storage.bucket(bucketName);
    const fileBuffer = await file.arrayBuffer();
    const blob = bucket.file(filePath);

    await blob.save(Buffer.from(fileBuffer), {
      metadata: {
        contentType: file.type,
      },
    });

    // Hacer el archivo público
    await blob.makePublic();

    // Obtener URL pública
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

    // Crear registro en Firestore
    const mediaData = {
      uri: publicUrl,
      alt: alt || null,
      type: mediaType,
      related: [],
      createdAt: new Date().toISOString(),
      createdBy: locals.user.uid,
    };

    const docRef = await db.collection('media').add(mediaData);

    return new Response(
      JSON.stringify({
        success: true,
        id: docRef.id,
        data: { id: docRef.id, ...mediaData },
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error uploading file:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(
      JSON.stringify({ success: false, error: 'Error al subir archivo', details: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
