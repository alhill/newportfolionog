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

export interface SeoData {
  metaTitle?: string;
  metaDescription?: string;
  canonicalPath?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
  twitterCard?: string;
  noIndex?: boolean;
  noFollow?: boolean;
  jsonLd?: string;
}

export type ContentPageId = 'index' | 'sobre-mi' | 'contacto';
export type GlobalSeoPageId = 'global-seo';
export type PredefinedPageId = ContentPageId | GlobalSeoPageId;

export interface PageDocument {
  id: ContentPageId;
  title: string;
  subtitle?: string;
  content?: string;
  ctaText?: string;
  ctaUrl?: string;
  published?: boolean;
  seo?: SeoData;
  updatedAt?: string;
}

export interface GlobalSeoDocument {
  id: GlobalSeoPageId;
  title: string;
  seo?: SeoData;
  updatedAt?: string;
}

export interface PageUpdateInput {
  title?: string;
  subtitle?: string;
  content?: string;
  ctaText?: string;
  ctaUrl?: string;
  published?: boolean;
  seo?: SeoData;
}

export interface GlobalSeoUpdateInput {
  seo?: SeoData;
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
  seo?: SeoData;
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
  seo?: SeoData;
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
  seo?: SeoData;
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

/**
 * Redirections Types
 */
export interface Redirection {
  id: string;
  name: string;
  from: string;
  to: string;
  createdAt: string;
  updatedAt?: string;
  createdBy: string;
}

export interface RedirectionCreateInput {
  name: string;
  from: string;
  to: string;
}

export interface RedirectionUpdateInput {
  name?: string;
  from?: string;
  to?: string;
}

export interface RedirectionsListResponse {
  success: boolean;
  data: Redirection[];
}

export interface RedirectionResponse {
  success: boolean;
  data: Redirection;
}
