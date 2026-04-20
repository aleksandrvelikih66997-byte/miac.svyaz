
"use client"

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2, Shield } from "lucide-react";
import { logoutLocal, getLocalSession } from '@/lib/auth-local';

export function AuthLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function check() {
      const current = await getLocalSession();
      setSession(current);
      
      const isLoginPage = pathname === '/login';
      
      if (!current && !isLoginPage) {
        router.replace('/login');
      } else if (current && isLoginPage) {
        router.replace('/');
      }
      setLoading(false);
    }
    check();
  }, [pathname, router]);

  const handleLogout = async () => {
    await logoutLocal();
    window.location.replace('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  if (pathname === '/login') {
    return <>{children}</>;
  }

  if (!session) return null;

  return (
    <SidebarProvider>
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
