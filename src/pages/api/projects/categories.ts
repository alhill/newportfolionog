import type { APIRoute } from 'astro';
import { adminDb } from '../../../lib/firebase-admin';

/**
 * GET /api/projects/categories
 * Obtiene la lista de categorías disponibles (únicas) de los proyectos
 */
export const GET: APIRoute = async () => {
  try {
    const snapshot = await adminDb.collection('projects').get();
    
    // Extraer categorías únicas
    const categoriesSet = new Set<string>();
    snapshot.docs.forEach(doc => {
      const category = doc.data().category;
      if (category) {
        categoriesSet.add(category);
      }
    });

    const categories = Array.from(categoriesSet).sort();

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: categories 
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching categories:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Error fetching categories' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};
