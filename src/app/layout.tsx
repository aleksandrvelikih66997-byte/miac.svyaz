
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { AuthLayoutWrapper } from '@/components/layout/auth-layout-wrapper';

export const metadata: Metadata = {
  title: 'АльтернаТИВ АТС | Управление телефонией',
  description: 'Профессиональный интерфейс управления Asterisk для AltLinux SP',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased bg-background text-foreground">
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
