import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import type { MediaItem } from '../types/api';

type ProjectMediaShape = {
  thumb?: string;
  headerImg?: string;
  media?: MediaItem[];
};

function normalizeUri(uri: unknown): string | null {
  if (typeof uri !== 'string') return null;
  const normalized = uri.trim();
  return normalized.length > 0 ? normalized : null;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export function collectProjectMediaUris(project: ProjectMediaShape): string[] {
  const uris = new Set<string>();

  const thumb = normalizeUri(project.thumb);
  if (thumb) uris.add(thumb);

  const headerImg = normalizeUri(project.headerImg);
  if (headerImg) uris.add(headerImg);

  for (const mediaItem of project.media || []) {
    if (mediaItem.type === 'gallery') {
      for (const image of mediaItem.images || []) {
        const normalized = normalizeUri(image);
        if (normalized) uris.add(normalized);
      }
      continue;
    }

    if (mediaItem.type === 'markdown') {
      continue;
    }

    const normalized = normalizeUri(mediaItem.uri);
    if (normalized) uris.add(normalized);
  }

  return Array.from(uris);
}

async function getMediaDocIdsByUris(uris: string[]): Promise<string[]> {
  if (uris.length === 0) return [];

  const docIds = new Set<string>();

  for (const uriChunk of chunk(uris, 10)) {
    const snapshot = await adminDb
      .collection('media')
      .where('uri', 'in', uriChunk)
      .get();

    for (const doc of snapshot.docs) {
      docIds.add(doc.id);
    }
  }

  return Array.from(docIds);
}

export async function syncProjectMediaRelations(
  projectId: string,
  previousUris: string[],
  nextUris: string[]
): Promise<void> {
  const previousSet = new Set(previousUris.map(normalizeUri).filter(Boolean) as string[]);
  const nextSet = new Set(nextUris.map(normalizeUri).filter(Boolean) as string[]);

  const urisToAdd = Array.from(nextSet).filter(uri => !previousSet.has(uri));
  const urisToRemove = Array.from(previousSet).filter(uri => !nextSet.has(uri));

  if (urisToAdd.length === 0 && urisToRemove.length === 0) {
    return;
  }

  const [mediaToAdd, mediaToRemove] = await Promise.all([
    getMediaDocIdsByUris(urisToAdd),
    getMediaDocIdsByUris(urisToRemove),
  ]);

  if (mediaToAdd.length === 0 && mediaToRemove.length === 0) {
    return;
  }

  const batch = adminDb.batch();

  for (const mediaDocId of mediaToAdd) {
    batch.update(adminDb.collection('media').doc(mediaDocId), {
      related: FieldValue.arrayUnion(projectId),
      updatedAt: new Date().toISOString(),
    });
  }

  for (const mediaDocId of mediaToRemove) {
    batch.update(adminDb.collection('media').doc(mediaDocId), {
      related: FieldValue.arrayRemove(projectId),
      updatedAt: new Date().toISOString(),
    });
  }

  await batch.commit();
}