import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outputPath = path.resolve(projectRoot, 'src/generated/redirections.snapshot.json');

loadDotenv({ path: path.resolve(projectRoot, '.env.local') });
loadDotenv({ path: path.resolve(projectRoot, '.env') });

function normalizePath(input) {
  const value = String(input || '').trim();
  if (!value) return '';

  try {
    const parsedUrl = new URL(value);
    return normalizePath(parsedUrl.pathname);
  } catch {
    // Not a full URL, continue with path normalization.
  }

  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  const collapsed = withLeadingSlash.replace(/\/+/g, '/');

  if (collapsed !== '/' && collapsed.endsWith('/')) {
    return collapsed.slice(0, -1);
  }

  return collapsed;
}

function parseServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_ADMIN_SDK_KEY;
  if (!raw || !raw.trim()) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`No se pudo parsear FIREBASE_SERVICE_ACCOUNT/FIREBASE_ADMIN_SDK_KEY: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function ensureOutputExists() {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  try {
    await fs.access(outputPath);
  } catch {
    const initialSnapshot = {
      generatedAt: null,
      source: 'seed',
      count: 0,
      items: [],
    };
    await fs.writeFile(outputPath, `${JSON.stringify(initialSnapshot, null, 2)}\n`, 'utf8');
  }
}

async function main() {
  await ensureOutputExists();

  const strictMode = process.env.REDIRECTIONS_SNAPSHOT_STRICT === 'true';

  try {
    const serviceAccount = parseServiceAccount();
    const projectId =
      process.env.FIREBASE_PROJECT_ID ||
      serviceAccount?.project_id ||
      process.env.GCLOUD_PROJECT ||
      process.env.GOOGLE_CLOUD_PROJECT;

    if (!projectId) {
      throw new Error('Falta FIREBASE_PROJECT_ID (o project_id dentro de FIREBASE_SERVICE_ACCOUNT).');
    }

    if (!getApps().length) {
      initializeApp({
        credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
        projectId,
      });
    }

    const db = getFirestore();
    const snapshot = await db.collection('redirections').orderBy('updatedAt', 'desc').get();

    const uniqueByFrom = new Map();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const from = normalizePath(data.from);
      const to = String(data.to || '').trim();

      if (!from || !to || uniqueByFrom.has(from)) {
        continue;
      }

      uniqueByFrom.set(from, {
        from,
        to,
        statusCode: 308,
        name: String(data.name || '').trim(),
        updatedAt: String(data.updatedAt || data.createdAt || ''),
      });
    }

    const items = Array.from(uniqueByFrom.values());
    const output = {
      generatedAt: new Date().toISOString(),
      source: 'firestore',
      count: items.length,
      items,
    };

    await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

    console.log(`Redirections snapshot generado: ${items.length} entradas en ${path.relative(projectRoot, outputPath)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (strictMode) {
      console.error(`Error generando redirections snapshot (modo estricto): ${message}`);
      process.exit(1);
    }

    console.warn(`No se pudo actualizar redirections snapshot. Se mantiene el JSON actual. Motivo: ${message}`);
  }
}

await main();
