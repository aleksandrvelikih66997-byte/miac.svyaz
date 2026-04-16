
'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'

/**
 * Инициализация Firebase.
 * Использует надежные заглушки для предотвращения ошибок во время сборки (build),
 * если реальные ключи еще не подставлены.
 */
export function initializeFirebase() {
  const isValidConfig = firebaseConfig.apiKey && firebaseConfig.apiKey !== 'api-key';
  
  const config = isValidConfig ? firebaseConfig : {
    apiKey: "AIzaSyDummyKey-ForBuild-Only-123456",
    authDomain: "miac-project.firebaseapp.com",
    projectId: "miac-project",
    storageBucket: "miac-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef123456"
  };

  if (!getApps().length) {
    const app = initializeApp(config);
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
