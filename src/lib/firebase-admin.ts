import { initializeApp, cert, getApps, type ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// Inicializar Firebase Admin solo si no está inicializado
if (!getApps().length) {
  // En producción (Cloud Run), las credenciales se obtienen automáticamente
  // En desarrollo, usar la variable de entorno si está disponible
  const serviceAccountEnv = import.meta.env.FIREBASE_SERVICE_ACCOUNT;
  let serviceAccount: ServiceAccount | undefined = undefined;

  if (serviceAccountEnv && serviceAccountEnv.trim().length > 0) {
    try {
      serviceAccount = JSON.parse(serviceAccountEnv);
    } catch (error) {
      console.error('Error parsing FIREBASE_SERVICE_ACCOUNT:', error);
      console.warn('Continuing without service account credentials. Firebase features may not work.');
    }
  }

  const appOptions: {
    credential?: ReturnType<typeof cert>;
    projectId?: string;
    storageBucket?: string;
  } = {
    projectId: import.meta.env.FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.FIREBASE_STORAGE_BUCKET,
  };

  if (serviceAccount) {
    appOptions.credential = cert(serviceAccount);
  }

  initializeApp(appOptions);
}

export const adminAuth = getAuth();
export const adminDb = getFirestore();
export const adminStorage = getStorage();

// Alias para compatibilidad
export const auth = adminAuth;
export const db = adminDb;
export const storage = adminStorage;
