import type { APIRoute } from 'astro';
import { adminDb } from '../../../lib/firebase-admin';
import { collectProjectMediaUris, syncProjectMediaRelations } from '../../../lib/media-relations';

/**
 * Generate a URL-friendly slug from a string
 */
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/-+/g, '-'); // Replace multiple - with single -
}

/**
 * Check if a slug is unique (excluding a specific document ID)
 */
async function isSlugUnique(slug: string, excludeId?: string): Promise<boolean> {
  const snapshot = await adminDb.collection('projects').where('slug', '==', slug).get();
  if (snapshot.empty) return true;
  if (excludeId && snapshot.docs.length === 1 && snapshot.docs[0].id === excludeId) return true;
  return false;
}

/**
 * Generate a unique slug from a title
 */
async function generateUniqueSlug(title: string, excludeId?: string): Promise<string> {
  let slug = generateSlug(title);
  let isUnique = await isSlugUnique(slug, excludeId);
  
  if (!isUnique) {
    let counter = 1;
    while (!isUnique && counter < 100) {
      const newSlug = `${slug}-${counter}`;
      isUnique = await isSlugUnique(newSlug, excludeId);
      if (isUnique) {
        slug = newSlug;
        break;
      }
      counter++;
    }
  }
  
  return slug;
}

/**
 * GET /api/projects/[id]
 * Obtiene un proyecto completo por ID o slug
 */
export const GET: APIRoute = async ({ params }) => {
  try {
    const { id } = params;

    if (!id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Project ID or slug is required' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    let doc;
    
    // Try to get by ID first
    const docRef = adminDb.collection('projects').doc(id);
    doc = await docRef.get();

    // If not found by ID, try by slug
    if (!doc.exists) {
      const snapshot = await adminDb.collection('projects').where('slug', '==', id).limit(1).get();
      if (!snapshot.empty) {
        doc = snapshot.docs[0];
      }
    }

    if (!doc || !doc.exists) {
      return new Response(
        JSON.stringify({ success: false, error: 'Project not found' }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: {
          id: doc.id,
          ...doc.data()
        }
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching project:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Error fetching project' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};

/**
 * PUT /api/projects/[id]
 * Actualiza un proyecto existente
 * Requiere autenticación
 */
export const PUT: APIRoute = async ({ params, request, locals }) => {
  try {
    // Verificar autenticación
    if (!locals.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const { id } = params;

    if (!id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Project ID is required' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const data = await request.json();
    const docRef = adminDb.collection('projects').doc(id);
    
    // Verificar que el documento existe
    const doc = await docRef.get();
    if (!doc.exists) {
      return new Response(
        JSON.stringify({ success: false, error: 'Project not found' }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const currentProjectData = doc.data() || {};

    // Preparar datos de actualización (sin poder modificar createdAt y createdBy)
    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    // Solo actualizar campos proporcionados
    const allowedFields = [
      'title', 'innerTitle', 'slug', 'cliente', 'campaña', 'agencia', 'papel', 'description', 
      'copy', 'arte', 'thumb', 'headerImg', 'media', 'category', 'featured', 'order',
      'width', 'height', 'seo'
    ];

    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    });

    // Handle slug updates
    if (data.slug !== undefined) {
      const newSlug = generateSlug(data.slug);
      const isUnique = await isSlugUnique(newSlug, id);
      if (!isUnique) {
        return new Response(
          JSON.stringify({ success: false, error: 'Slug already exists' }),
          { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      updateData.slug = newSlug;
    } else if (data.title !== undefined && !doc.data()?.slug) {
      // Generate slug if title changed and no slug exists
      updateData.slug = await generateUniqueSlug(data.title, id);
    }

    const previousUris = collectProjectMediaUris(currentProjectData);
    const nextProjectData = {
      ...currentProjectData,
      ...updateData,
    };
    const nextUris = collectProjectMediaUris(nextProjectData);

    await docRef.update(updateData);
    await syncProjectMediaRelations(id, previousUris, nextUris);

    // Obtener el documento actualizado
    const updatedDoc = await docRef.get();

    return new Response(
      JSON.stringify({ 
        success: true,
        data: {
          id: updatedDoc.id,
          ...updatedDoc.data()
        }
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error updating project:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Error updating project' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};

/**
 * DELETE /api/projects/[id]
 * Elimina un proyecto
 * Requiere autenticación
 */
export const DELETE: APIRoute = async ({ params, locals }) => {
  try {
    // Verificar autenticación
    if (!locals.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const { id } = params;

    if (!id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Project ID is required' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const docRef = adminDb.collection('projects').doc(id);
    
    // Verificar que el documento existe
    const doc = await docRef.get();
    if (!doc.exists) {
      return new Response(
        JSON.stringify({ success: false, error: 'Project not found' }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const projectData = doc.data() || {};
    await syncProjectMediaRelations(id, collectProjectMediaUris(projectData), []);

    await docRef.delete();

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Project deleted successfully'
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error deleting project:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Error deleting project' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};
