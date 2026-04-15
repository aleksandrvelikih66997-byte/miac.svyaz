
import type { Metadata } from 'next';
import './globals.css';
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { Toaster } from "@/components/ui/toaster"

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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-background text-foreground">
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-card/50 backdrop-blur-sm px-4 sticky top-0 z-30">
              <SidebarTrigger className="-ml-1" />
              <div className="flex-1 px-4">
                <h1 className="font-headline font-semibold text-lg">Панель управления</h1>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-tight">Сервер онлайн</span>
                </div>
              </div>
            </header>
            <main className="flex flex-1 flex-col gap-4 p-6 overflow-y-auto">
              {children}
            </main>
          </SidebarInset>
        </SidebarProvider>
        <Toaster />
      </body>
    </html>
  );
}
