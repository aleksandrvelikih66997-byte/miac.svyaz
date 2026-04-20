"use client"

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2 } from "lucide-react";
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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
        <header className="flex h-16 items-center justify-between border-b px-6 sticky top-0 z-30 bg-background/80 backdrop-blur">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <span className="font-bold uppercase tracking-tight text-primary">Панель МИАЦ.СВЯЗЬ</span>
          </div>
          <div className="flex items-center gap-4">
             <span className="text-xs text-muted-foreground hidden md:inline">{session.email}</span>
             <Button variant="ghost" size="sm" onClick={handleLogout} className="text-destructive gap-2 font-bold">
               <LogOut className="h-4 w-4" /> Выйти
             </Button>
          </div>
        </header>
        <main className="p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
