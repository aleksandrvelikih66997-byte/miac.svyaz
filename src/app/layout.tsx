
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { AuthLayoutWrapper } from '@/components/layout/auth-layout-wrapper';
import { getLocalSession } from '@/lib/auth-local';

export const metadata: Metadata = {
  title: 'МИАЦ.СВЯЗЬ | Панель управления Asterisk',
  description: 'Локальная панель управления телефонией для AltLinux SP 10 (ФСТЭК Ready)',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Получаем сессию на стороне сервера для предотвращения "мерцания" и петель редиректа
  const session = await getLocalSession();

  return (
    <html lang="ru">
      <body className="antialiased bg-background text-foreground font-sans">
        <FirebaseClientProvider>
          <AuthLayoutWrapper initialSession={session}>
            {children}
          </AuthLayoutWrapper>
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
