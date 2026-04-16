"use client"

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2 } from "lucide-react";
import { logoutLocal, getLocalSession } from '@/lib/auth-local';

export function AuthLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === '/login';
  
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const currentSession = await getLocalSession();
      setSession(currentSession);
      
      if (!currentSession && !isLoginPage) {
        router.replace('/login');
      } else if (currentSession && isLoginPage) {
        router.replace('/');
      }
    } catch (err) {
      console.error("Auth check failed", err);
    } finally {
      setLoading(false);
    }
  }, [isLoginPage, router]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth, pathname]);

  const handleLogout = async () => {
    await logoutLocal();
    setSession(null);
    window.location.href = '/login';
  };

  const getPageTitle = (path: string) => {
    switch (path) {
      case '/': return 'Дашборд';
      case '/extensions': return 'Абоненты';
      case '/trunks': return 'Транки';
      case '/services': return 'Настройки';
      case '/history': return 'История';
      case '/ai-assistant': return 'ИИ Помощник';
      case '/routing': return 'Маршрутизация';
      default: return 'Панель управления';
    }
  };

  // Пока идет загрузка, показываем экран ожидания
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground font-headline uppercase tracking-widest">Проверка сессии...</p>
      </div>
    );
  }

  // Если мы на странице логина, просто рендерим контент
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Если сессии нет (и мы не на странице логина), ничего не рендерим (сработает редирект в checkAuth)
  if (!session) {
    return null;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-background">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-white/50 backdrop-blur-sm px-6 sticky top-0 z-30 justify-between">
          <div className="flex items-center gap-4">
            <SidebarTrigger className="-ml-1 text-muted-foreground" />
            <h1 className="font-bold text-xl tracking-tight">{getPageTitle(pathname)}</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-tighter">Система активна</span>
            </div>
            
            <Button 
              variant="destructive" 
              size="sm" 
              className="h-9 gap-2 text-xs font-medium bg-rose-100 text-rose-700 hover:bg-rose-200 border-none shadow-none"
              onClick={handleLogout}
            >
              <LogOut className="h-3.5 w-3.5" /> Выйти
            </Button>
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-6 p-8 overflow-y-auto">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
