
'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Button } from "@/components/ui/button";
import { LogOut, Shield } from "lucide-react";
import { logoutLocal } from '@/lib/auth-local';

interface AuthLayoutWrapperProps {
  children: React.ReactNode;
  initialSession: any;
}

export function AuthLayoutWrapper({ children, initialSession }: AuthLayoutWrapperProps) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  useEffect(() => {
    // Если сессия есть, а мы на странице логина — уходим в корень
    if (initialSession && isLoginPage) {
      window.location.assign('/');
    }
    // Если сессии нет, а мы НЕ на странице логина — уходим на логин
    if (!initialSession && !isLoginPage) {
      window.location.assign('/login');
    }
  }, [initialSession, isLoginPage]);

  const handleLogout = async () => {
    await logoutLocal();
    window.location.assign('/login');
  };

  // 1. Показываем страницу логина без сайдбара
  if (isLoginPage) {
    return <>{children}</>;
  }

  // 2. Пока идет проверка сессии (если её нет в initialSession), ничего не рендерим во избежание мерцания
  if (!initialSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Проверка доступа...</p>
        </div>
      </div>
    );
  }

  // 3. Рендерим основное приложение
  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 items-center justify-between border-b px-8 sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-bold uppercase tracking-tight text-primary text-sm">Панель управления МИАЦ.СВЯЗЬ</span>
          </div>
          <div className="flex items-center gap-6">
             <div className="flex flex-col items-end">
               <span className="text-xs font-bold text-slate-700">{initialSession.email}</span>
               <span className="text-[10px] text-muted-foreground uppercase tracking-tighter">Администратор системы</span>
             </div>
             <div className="h-8 w-px bg-border mx-2" />
             <Button variant="ghost" size="sm" onClick={handleLogout} className="text-destructive hover:bg-destructive/5 gap-2 font-bold h-9">
               <LogOut className="h-4 w-4" /> Выход
             </Button>
          </div>
        </header>
        <main className="p-8 max-w-[1600px] mx-auto w-full">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
