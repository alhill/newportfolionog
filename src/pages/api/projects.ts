import type { APIRoute } from 'astro';
import { adminDb } from '../../lib/firebase-admin';
import { collectProjectMediaUris, syncProjectMediaRelations } from '../../lib/media-relations';
import type { Project } from '../../types/api';

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
 * GET /api/projects
 * Lista proyectos con paginación y filtros
 * Query params:
 * - page: número de página (default: 1)
 * - limit: items por página (default: 10, max: 50)
 * - category: filtrar por categoría
 * - featured: true/false para proyectos destacados
 */
export const GET: APIRoute = async ({ url }) => {
  try {
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50);
    const category = url.searchParams.get('category');
    const featured = url.searchParams.get('featured');

    let query = adminDb.collection('projects').orderBy('order', 'desc').orderBy('createdAt', 'desc');

    // Aplicar filtros
    if (category) {
      query = query.where('category', '==', category) as any;
    }
    if (featured === 'true') {
      query = query.where('featured', '==', true) as any;
    }

    // Paginación
    const skip = (page - 1) * limit;
    if (skip > 0) {
      const startAfterSnapshot = await adminDb.collection('projects')
        .orderBy('order', 'desc')
        .orderBy('createdAt', 'desc')
        .limit(skip)
        .get();
      const lastDoc = startAfterSnapshot.docs[startAfterSnapshot.docs.length - 1];
      if (lastDoc) {
        query = query.startAfter(lastDoc) as any;
      }
    }

    const snapshot = await query.limit(limit).get();

    // Obtener total de documentos para paginación
    let totalQuery = adminDb.collection('projects');
    if (category) {
      totalQuery = totalQuery.where('category', '==', category) as any;
    }
    if (featured === 'true') {
      totalQuery = totalQuery.where('featured', '==', true) as any;
    }
    const totalSnapshot = await totalQuery.count().get();
    const total = totalSnapshot.data().count;

    // Mapear solo campos básicos para el listado
    const projects = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        slug: data.slug,
        title: data.title,
        description: data.description,
        thumb: data.thumb,
        category: data.category,
        featured: data.featured || false,
        order: data.order || 0,
        width: data.width || 1,
        height: data.height || 1,
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: projects,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching projects:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Error fetching projects' }),
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
 * POST /api/projects
 * Crea un nuevo proyecto
 * Requiere autenticación
 */
export const POST: APIRoute = async ({ request, locals }) => {
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

    const data = await request.json();

    // Validar campos requeridos
    const requiredFields = ['title', 'slug'];
    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Missing required fields: ${missingFields.join(', ')}` 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const projectsRef = adminDb.collection('projects');
    const now = new Date().toISOString();
    
    let slug = generateSlug(data.slug);

    if (!slug) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Slug inválido'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Validate slug uniqueness
    if (!(await isSlugUnique(slug))) {
      slug = await generateUniqueSlug(data.title);
    }
    
    const projectData: Omit<Project, 'id'> = {
      slug,
      title: data.title,
      cliente: data.cliente || '',
      campaña: data.campaña || '',
      agencia: data.agencia || '',
      papel: data.papel || '',
      copy: data.copy || '',
      arte: data.arte || '',
      description: data.description || '',
      thumb: data.thumb || '',
      headerImg: data.headerImg || data.thumb || '',
      media: data.media || [],
      category: data.category || 'General',
      featured: data.featured || false,
      order: data.order || 0,
      seo: data.seo || {},
      createdAt: now,
      createdBy: locals.user.uid,
    };

    const docRef = await projectsRef.add(projectData);

    await syncProjectMediaRelations(
      docRef.id,
      [],
      collectProjectMediaUris(projectData)
    );

    return new Response(
      JSON.stringify({ 
        success: true, 
        id: docRef.id,
        data: { id: docRef.id, ...projectData }
      }),
      {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error creating project:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Error creating project' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};
