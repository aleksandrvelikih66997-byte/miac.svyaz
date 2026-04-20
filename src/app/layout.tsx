
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { AuthLayoutWrapper } from '@/components/layout/auth-layout-wrapper';

export const metadata: Metadata = {
  title: 'МИАЦ.СВЯЗЬ | Панель управления Asterisk',
  description: 'Локальная панель управления телефонией для AltLinux SP 10 (ФСТЭК Ready)',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased bg-background text-foreground font-sans">
        <FirebaseClientProvider>
          <AuthLayoutWrapper>
            {children}
          </AuthLayoutWrapper>
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
