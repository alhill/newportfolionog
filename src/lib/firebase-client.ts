import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { resolvePublicEnvValue } from './public-env';

function getFirebaseConfig() {
  return {
    apiKey: resolvePublicEnvValue('PUBLIC_FIREBASE_API_KEY') ?? '',
    authDomain: resolvePublicEnvValue('PUBLIC_FIREBASE_AUTH_DOMAIN') ?? '',
    projectId: resolvePublicEnvValue('PUBLIC_FIREBASE_PROJECT_ID') ?? '',
    storageBucket: resolvePublicEnvValue('PUBLIC_FIREBASE_STORAGE_BUCKET') ?? '',
    messagingSenderId: resolvePublicEnvValue('PUBLIC_FIREBASE_MESSAGING_SENDER_ID') ?? '',
    appId: resolvePublicEnvValue('PUBLIC_FIREBASE_APP_ID') ?? '',
  };
}

let app: FirebaseApp | undefined;
let authInstance: Auth | undefined;

function initFirebaseAuth(): Auth {
  if (typeof window === 'undefined') {
    throw new Error('Firebase client is only available in the browser.');
  }

  if (authInstance) {
    return authInstance;
  }

  const firebaseConfig = getFirebaseConfig();

  if (!firebaseConfig.apiKey) {
    throw new Error(
      'Firebase client config is missing. Set PUBLIC_FIREBASE_* in `.env` (local) or Cloud Run env vars.',
    );
  }

  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  authInstance = getAuth(app);
  return authInstance;
}

export const auth: Auth = new Proxy({} as Auth, {
  get(_target, prop) {
    const instance = initFirebaseAuth();
    const value = Reflect.get(instance, prop, instance);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});
