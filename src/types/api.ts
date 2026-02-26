/**
 * Tipos compartidos para la API de proyectos
 */

export interface MediaItem {
  type: 'image' | 'gallery' | 'video' | 'embed' | 'pdf' | 'markdown';
  uri?: string; // URL para image, video, embed, pdf; contenido para markdown
  images?: string[]; // URLs para gallery
  width: 'full' | 'half'; // Ancho del elemento
  caption?: string; // Descripción opcional del elemento
}

export interface Project {
  id: string;
  slug: string;
  title: string;
  cliente?: string;
  campaña?: string;
  agencia?: string;
  papel?: string;
  copy?: string;
  arte?: string;
  description?: string; // Markdown
  thumb?: string;
  headerImg?: string;
  media?: MediaItem[];
  category?: string;
  featured?: boolean;
  order?: number;
  width?: number; // Columnas que ocupa en masonry (1-4)
  height?: number; // Filas que ocupa en masonry (1-2)
  createdAt: string;
  updatedAt?: string;
  createdBy: string;
}

export interface ProjectListItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  thumb: string;
  category: string;
  featured: boolean;
  order: number;
  width?: number;
  height?: number;
}

export interface ProjectCreateInput {
  title: string;
  slug: string;
  cliente?: string;
  campaña?: string;
  agencia?: string;
  papel?: string;
  copy?: string;
  arte?: string;
  description?: string;
  thumb?: string;
  headerImg?: string;
  media?: MediaItem[];
  category?: string;
  featured?: boolean;
  order?: number;
}

export interface ProjectUpdateInput {
  title?: string;
  cliente?: string;
  campaña?: string;
  agencia?: string;
  papel?: string;
  copy?: string;
  arte?: string;
  description?: string;
  thumb?: string;
  headerImg?: string;
  media?: MediaItem[];
  category?: string;
  featured?: boolean;
  order?: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ProjectsListResponse {
  success: boolean;
  data: ProjectListItem[];
  pagination: Pagination;
}

export interface ProjectResponse {
  success: boolean;
  data: Project;
}

export interface ProjectCreateResponse {
  success: boolean;
  id: string;
  data: Project;
}

export interface ErrorResponse {
  success: false;
  error: string;
}

export interface CategoriesResponse {
  success: boolean;
  data: string[];
}

/**
 * Media Management Types
 */
export interface Media {
  id: string;
  uri: string;
  alt?: string;
  type: 'image' | 'video' | 'pdf' | 'audio';
  related: string[]; // IDs de proyectos que usan este medio
  createdAt: string;
  createdBy: string;
}

export interface MediaListItem {
  id: string;
  uri: string;
  alt?: string;
  type: 'image' | 'video' | 'pdf' | 'audio';
  relatedCount: number;
}

export interface MediaCreateInput {
  uri: string;
  alt?: string;
  type: 'image' | 'video' | 'pdf' | 'audio';
}

export interface MediaUpdateInput {
  alt?: string;
  related?: string[];
}

export interface MediaListResponse {
  success: boolean;
  data: MediaListItem[];
  pagination: Pagination;
}

export interface MediaResponse {
  success: boolean;
  data: Media;
}
