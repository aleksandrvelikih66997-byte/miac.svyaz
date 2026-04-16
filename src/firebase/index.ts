
'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'

/**
 * Инициализация Firebase.
 * Проверяет валидность ключей перед инициализацией, чтобы не ломать сборку.
 */
export function initializeFirebase() {
  const isValidConfig = firebaseConfig.apiKey && firebaseConfig.apiKey !== 'api-key';

  if (!getApps().length) {
    // Если конфиг невалидный (заглушка), инициализируем с минимальными данными для предотвращения вылета
    const app = initializeApp(isValidConfig ? firebaseConfig : {
      apiKey: "dummy",
      authDomain: "dummy",
      projectId: "dummy-project"
    });
    return getSdks(app);
  }

  return getSdks(getApp());
}

export function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp)
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
