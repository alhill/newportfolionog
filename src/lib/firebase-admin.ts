import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type ServiceAccount,
} from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import {
  getFirebaseProjectId,
  getServerEnvTrimmed,
  parseServiceAccountJson,
} from './server-env';

if (!getApps().length) {
  const serviceAccount = parseServiceAccountJson() as ServiceAccount | undefined;
  const projectId = getFirebaseProjectId();
  const storageBucket = getServerEnvTrimmed('FIREBASE_STORAGE_BUCKET');

  const appOptions: {
    credential?: ReturnType<typeof cert> | ReturnType<typeof applicationDefault>;
    projectId?: string;
    storageBucket?: string;
  } = {
    projectId,
    storageBucket,
  };

  if (serviceAccount) {
    appOptions.credential = cert(serviceAccount);
  } else if (process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT) {
    // Cloud Run / GCP: Application Default Credentials
    appOptions.credential = applicationDefault();
  }

  initializeApp(appOptions);
}

export const adminAuth = getAuth();
export const adminDb = getFirestore();
export const adminStorage = getStorage();

export const auth = adminAuth;
export const db = adminDb;
export const storage = adminStorage;
