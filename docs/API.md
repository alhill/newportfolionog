# API Documentation - Projects

## Endpoints disponibles

### 📋 Listar proyectos (con paginación y filtros)
**GET** `/api/projects`

Lista proyectos con información básica (título, thumb, descripción).

**Query Parameters:**
- `page` (number, default: 1) - Número de página
- `limit` (number, default: 10, max: 50) - Items por página
- `category` (string, optional) - Filtrar por categoría
- `featured` (boolean, optional) - Filtrar proyectos destacados

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "project-id",
      "title": "Mi Proyecto",
      "description": "Descripción corta",
      "thumb": "https://...",
      "category": "web",
      "featured": false,
      "order": 0
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**Ejemplos:**
```bash
# Listar todos los proyectos (página 1)
GET /api/projects

# Página 2 con 5 items
GET /api/projects?page=2&limit=5

# Filtrar por categoría
GET /api/projects?category=web

# Solo proyectos destacados
GET /api/projects?featured=true

# Combinar filtros
GET /api/projects?category=mobile&featured=true&page=1&limit=10
```

---

### 📄 Obtener un proyecto completo
**GET** `/api/projects/[id]`

Obtiene toda la información de un proyecto específico.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "project-id",
    "title": "Mi Proyecto",
    "description": "Descripción completa",
    "thumb": "https://...",
    "category": "web",
    "content": "Contenido markdown del proyecto...",
    "images": ["url1", "url2"],
    "technologies": ["React", "Node.js"],
    "url": "https://proyecto.com",
    "github": "https://github.com/user/repo",
    "featured": false,
    "order": 0,
    "createdAt": "2026-02-11T10:00:00Z",
    "updatedAt": "2026-02-11T12:00:00Z",
    "createdBy": "user-uid"
  }
}
```

---

### ➕ Crear proyecto
**POST** `/api/projects`

🔒 **Requiere autenticación**

Crea un nuevo proyecto.

**Headers:**
```
Authorization: Bearer <token>
Cookie: session=<token>
```

**Body:**
```json
{
  "title": "Mi Proyecto",           // required
  "cliente": "Nombre Cliente",      // required
  "campaña": "Nombre Campaña",      // required
  "agencia": "Nombre Agencia",      // required
  "papel": "Director Creativo",     // required
  "description": "**Descripción** en *markdown*",  // required
  "thumb": "https://...",           // required
  "headerImg": "https://...",       // required
  "category": "web",                // required
  "media": [                        // optional
    {
      "uri": "https://...",
      "type": "image",
      "layout": "two-columns"
    }
  ],
  "featured": false,                // optional
  "order": 0                        // optional
}
```

**Response:**
```json
{
  "success": true,
  "id": "new-project-id",
  "data": { ... }
}
```

---

### ✏️ Actualizar proyecto
**PUT** `/api/projects/[id]`

🔒 **Requiere autenticación**

Actualiza un proyecto existente. Solo se actualizan los campos enviados.

**Headers:**
```
Authorization: Bearer <token>
Cookie: session=<token>
```

**Body:** (todos los campos son opcionales)
```json
{
  "title": "Nuevo título",
  "description": "Nueva descripción",
  "featured": true
}
```

**Response:**
```json
{
  "success": true,
  "data": { ... } // proyecto actualizado
}
```

---

### 🗑️ Eliminar proyecto
**DELETE** `/api/projects/[id]`

🔒 **Requiere autenticación**

Elimina un proyecto.

**Headers:**
```
Authorization: Bearer <token>
Cookie: session=<token>
```

**Response:**
```json
{
  "success": true,
  "message": "Project deleted successfully"
}
```

---

### 🏷️ Obtener categorías
**GET** `/api/projects/categories`

Obtiene la lista de categorías únicas de todos los proyectos.

**Response:**
```json
{
  "success": true,
  "data": ["web", "mobile", "desktop", "api"]
}
```

---

## Estructura de datos: Project

```typescript
interface MediaItem {
  uri: string;                   // URL del recurso
  type: 'image' | 'video' | 'audio' | 'embed';  // Tipo de media
  layout?: string;               // Marcado HTML opcional (ej: "max-height-500", "two-columns")
}

interface Project {
  id: string;                    // Auto-generado
  title: string;                 // Título del proyecto
  cliente: string;               // Nombre del cliente
  campaña: string;               // Nombre de la campaña
  agencia: string;               // Agencia involucrada
  papel: string;                 // Papel/rol en el proyecto
  description: string;           // Descripción en Markdown
  thumb: string;                 // URL de thumbnail (listados)
  headerImg: string;             // URL de imagen principal
  media: MediaItem[];            // Galería de media
  category: string;              // Categoría del proyecto
  featured?: boolean;            // Proyecto destacado
  order?: number;                // Orden de visualización
  createdAt: string;             // ISO timestamp
  updatedAt?: string;            // ISO timestamp
  createdBy: string;             // UID del creador
}
```

---

## Códigos de error

- **400** - Bad Request (faltan parámetros requeridos)
- **401** - Unauthorized (se requiere autenticación)
- **404** - Not Found (proyecto no encontrado)
- **500** - Internal Server Error

---

## Ejemplos de uso

### JavaScript/Fetch

```javascript
// Listar proyectos con filtros
const response = await fetch('/api/projects?category=web&limit=6');
const { data, pagination } = await response.json();

// Obtener un proyecto
const project = await fetch('/api/projects/abc123');
const { data } = await project.json();

// Crear proyecto (con autenticación)
const token = await auth.currentUser.getIdToken();
const response = await fetch('/api/projects', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: 'Nuevo Proyecto',
    description: 'Descripción',
    thumb: 'https://...',
    category: 'web'
  })
});

// Actualizar proyecto
await fetch('/api/projects/abc123', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    featured: true,
    order: 10
  })
});

// Eliminar proyecto
await fetch('/api/projects/abc123', {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### Firestore Indexes requeridos

Para que la paginación y filtros funcionen correctamente, necesitas crear estos índices compuestos en Firestore:

1. **Índice**: `projects` collection
   - `category` (Ascending) + `order` (Descending) + `createdAt` (Descending)

2. **Índice**: `projects` collection
   - `featured` (Ascending) + `order` (Descending) + `createdAt` (Descending)

3. **Índice**: `projects` collection
   - `category` (Ascending) + `featured` (Ascending) + `order` (Descending) + `createdAt` (Descending)

Firestore te sugerirá crear estos índices cuando intentes hacer las queries. Puedes crearlos desde la consola o usar el link que proporciona el error.

---

# API Documentation - Media Management

## Endpoints disponibles

### 📋 Listar medios (con paginación y filtros)
**GET** `/api/media`

Lista medios con información básica.

**Query Parameters:**
- `page` (number, default: 1) - Número de página
- `limit` (number, default: 24) - Items por página
- `type` (string, optional) - Filtrar por tipo: `image`, `video`, `pdf`, `audio`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "media-id",
      "uri": "https://storage.googleapis.com/.../file.jpg",
      "alt": "Texto alternativo",
      "type": "image",
      "relatedCount": 2
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 24,
    "total": 50,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### 📄 Obtener un medio específico
**GET** `/api/media/:id`

Obtiene los detalles completos de un medio.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "media-id",
    "uri": "https://storage.googleapis.com/.../file.jpg",
    "alt": "Texto alternativo",
    "type": "image",
    "related": ["project-id-1", "project-id-2"],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "createdBy": "user-uid"
  }
}
```

### ➕ Crear nuevo medio (manual)
**POST** `/api/media`

Crea un registro de medio con una URL existente.

**Headers:**
- `Authorization: Bearer <token>` (requerido)

**Body:**
```json
{
  "uri": "https://example.com/image.jpg",
  "alt": "Texto alternativo",
  "type": "image"
}
```

**Response:**
```json
{
  "success": true,
  "id": "new-media-id",
  "data": {
    "id": "new-media-id",
    "uri": "https://example.com/image.jpg",
    "alt": "Texto alternativo",
    "type": "image",
    "related": [],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "createdBy": "user-uid"
  }
}
```

### 📤 Subir archivo a Firebase Storage
**POST** `/api/media/upload`

Sube un archivo a Firebase Storage y crea automáticamente el registro en Firestore.

**Headers:**
- `Authorization: Bearer <token>` (requerido)

**Body:** (multipart/form-data)
- `file` (File, requerido) - Archivo a subir (máx 50MB)
- `alt` (string, opcional) - Texto alternativo

**Response:**
```json
{
  "success": true,
  "id": "new-media-id",
  "data": {
    "id": "new-media-id",
    "uri": "https://storage.googleapis.com/.../timestamp_filename.jpg",
    "alt": "Texto alternativo",
    "type": "image",
    "related": [],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "createdBy": "user-uid"
  }
}
```

**Tipos de archivo soportados:**
- Imágenes: image/*
- Videos: video/*
- PDFs: application/pdf
- Audio: audio/*

### ✏️ Actualizar medio
**PUT** `/api/media/:id`

Actualiza la información de un medio existente.

**Headers:**
- `Authorization: Bearer <token>` (requerido)

**Body:**
```json
{
  "alt": "Nuevo texto alternativo",
  "related": ["project-id-1", "project-id-3"]
}
```

**Response:**
```json
{
  "success": true
}
```

### 🗑️ Eliminar medio
**DELETE** `/api/media/:id`

Elimina un medio. **Falla si el medio está siendo usado en proyectos**.

**Headers:**
- `Authorization: Bearer <token>` (requerido)

**Response (éxito):**
```json
{
  "success": true
}
```

**Response (en uso):**
```json
{
  "success": false,
  "error": "Este medio está siendo usado en 2 proyecto(s)",
  "relatedProjects": ["project-id-1", "project-id-2"]
}
```

## Estructura de datos

### Media
```typescript
{
  id: string;
  uri: string;                    // URL del archivo
  alt?: string;                   // Texto alternativo
  type: 'image' | 'video' | 'pdf' | 'audio';
  related: string[];              // IDs de proyectos que usan este medio
  createdAt: string;              // ISO 8601
  createdBy: string;              // UID del usuario
}
```

## Variables de entorno requeridas

Añade estas variables a tu `.env`:

```bash
# Firebase Storage
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
```

## Interfaz de administración

Accede a `/admin/media` para:
- Ver cuadrícula de medios con thumbnails
- Subir nuevos archivos
- Filtrar por tipo
- Ver detalles de cada medio
- Copiar URLs
- Editar texto alternativo
- Ver en qué proyectos se usa cada medio
- Eliminar medios (con advertencia si están en uso)

## Notas importantes

1. **Tamaño máximo**: Los archivos están limitados a 50MB
2. **Archivos públicos**: Todos los archivos subidos se hacen públicos automáticamente
3. **Prevención de eliminación**: No se puede eliminar un medio que esté siendo usado
4. **Nombres únicos**: Los archivos se renombran con timestamp para evitar colisiones
