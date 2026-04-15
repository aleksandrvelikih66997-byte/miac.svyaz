'use client';

import { usePathname } from 'next/navigation';
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Button } from "@/components/ui/button";
import { RefreshCcw, LogOut } from "lucide-react";
import { useAuth } from "@/firebase";
import { signOut } from "firebase/auth";

export function AuthLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';
  const auth = useAuth();

  const handleLogout = () => {
    signOut(auth);
  };

  const getPageTitle = (path: string) => {
    switch (path) {
      case '/': return 'Дашборд';
      case '/extensions': return 'Абоненты';
      case '/trunks': return 'Транки';
      case '/services': return 'Настройки';
      case '/history': return 'История';
      case '/ai-assistant': return 'ИИ Помощник';
      default: return 'Панель управления';
    }
  };

  if (isLoginPage) {
    return <>{children}</>;
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
              <div className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="text-xs font-medium text-muted-foreground">Asterisk - загрузка...</span>
            </div>
            
            <Button variant="outline" size="sm" className="h-9 gap-2 text-xs font-medium bg-white shadow-sm hover:bg-slate-50">
              <RefreshCcw className="h-3.5 w-3.5" /> Обновить
            </Button>
            
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
