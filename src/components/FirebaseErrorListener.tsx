'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';

export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handlePermissionError = (error: FirestorePermissionError) => {
      toast({
        variant: "destructive",
        title: "Ошибка доступа",
        description: `У вас недостаточно прав для выполнения операции: ${error.context.operation} на ${error.context.path}`,
      });
      // In development, we can also log to console
      if (process.env.NODE_ENV === 'development') {
        console.error('Firestore Permission Error Context:', error.context);
      }
    };

    errorEmitter.on('permission-error', handlePermissionError);
    return () => {
      errorEmitter.off('permission-error', handlePermissionError);
    };
  }, [toast]);

  return null;
}
