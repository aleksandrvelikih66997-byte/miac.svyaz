
"use client"

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
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
  const router = useRouter();
  const [session, setSession] = useState<any>(initialSession);

  const isLoginPage = pathname === '/login';

  // Синхронизируем сессию, если она изменилась на сервере
  useEffect(() => {
    setSession(initialSession);
  }, [initialSession]);

  // Управляем редиректами только если состояние сессии не соответствует пути
  useEffect(() => {
    if (!session && !isLoginPage) {
      router.replace('/login');
    } else if (session && isLoginPage) {
      router.replace('/');
    }
  }, [session, isLoginPage, router]);

  const handleLogout = async () => {
    await logoutLocal();
    // Полная перезагрузка для очистки всех состояний
    window.location.assign('/login');
  };

  // Если мы на странице логина, просто рендерим контент
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Если сессии нет и мы не на логине, ждем редиректа (или показываем пустой экран)
  if (!session) {
    return null;
  }

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
               <span className="text-xs font-bold text-slate-700">{session.email}</span>
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
