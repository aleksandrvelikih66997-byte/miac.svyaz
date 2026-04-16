'use client';

import { createContext, useContext, ReactNode } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import { Auth } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

interface FirebaseContextType {
  app: FirebaseApp;
  db: Firestore;
  auth: Auth;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export function FirebaseProvider({ 
  children, 
  app, 
  db, 
  auth 
}: FirebaseContextType & { children: ReactNode }) {
  return (
    <FirebaseContext.Provider value={{ app, db, auth }}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
}

export const useFirebaseApp = () => {
  const context = useContext(FirebaseContext);
  if (!context) throw new Error('useFirebaseApp must be used within FirebaseProvider');
  return context.app;
};

export const useFirestore = () => {
  const context = useContext(FirebaseContext);
  if (!context) throw new Error('useFirestore must be used within FirebaseProvider');
  return context.db;
};

export const useAuth = () => {
  const context = useContext(FirebaseContext);
  if (!context) throw new Error('useAuth must be used within FirebaseProvider');
  return context.auth;
};
