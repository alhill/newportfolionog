import { signal, computed } from '@preact/signals';
import { auth } from '../../lib/firebase-client';
import { signOut } from 'firebase/auth';

// Estado global
export const user = signal(null);
export const loading = signal(true);

// Computed
export const isAuthenticated = computed(() => user.value !== null);

// Acciones
export const logout = async () => {
  try {
    await signOut(auth);
    document.cookie = 'session=; path=/; max-age=0';
    window.location.href = '/admin/login';
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
  }
};

export const initAuth = (userData) => {
  user.value = userData;
  loading.value = false;
};
