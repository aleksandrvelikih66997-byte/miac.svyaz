
"use client"

import * as React from "react"
import { 
  Users, 
  Settings, 
  Database, 
  LayoutDashboard,
  ShieldCheck,
  Phone,
  Mic2,
  ListOrdered
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarFooter,
} from "@/components/ui/sidebar"

const groups = [
  {
    label: "Контроль",
    items: [
      { name: "Обзор", href: "/", icon: LayoutDashboard },
      { name: "Абоненты", href: "/extensions", icon: Users },
      { name: "Транки", href: "/trunks", icon: Database },
    ]
  },
  {
    label: "Логика звонков",
    items: [
      { name: "Маршрутизация", href: "/routing", icon: Phone },
      { name: "Очереди", href: "/queues", icon: ListOrdered },
      { name: "Голосовое меню", href: "/ivr", icon: Mic2 },
    ]
  },
  {
    label: "Система",
    items: [
      { name: "Управление", href: "/services", icon: Settings },
      { name: "ИИ Помощник", href: "/ai-assistant", icon: ShieldCheck },
    ]
  }
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="none" className="bg-sidebar border-r min-h-screen h-full">
      <SidebarHeader className="px-6 py-6 border-b border-sidebar-border/50">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white shadow-lg">
            <Phone className="h-6 w-6" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg text-sidebar-foreground">МИАЦ.СВЯЗЬ</span>
            <span className="text-[10px] text-sidebar-foreground/50 uppercase tracking-tighter font-bold">v1.0 • Asterisk 17 free</span>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="px-2 scrollbar-none flex-1">
        {groups.map((group) => (
          <SidebarGroup key={group.label} className="py-2">
            <SidebarGroupLabel className="text-sidebar-foreground/30 font-bold uppercase text-[10px] tracking-widest">{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.href}
                      className="px-4 py-6 data-[active=true]:bg-primary data-[active=true]:text-white transition-all duration-200"
                    >
                      <Link href={item.href} className="flex items-center gap-3">
                        <item.icon className="h-5 w-5" />
                        <span className="font-medium">{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-sidebar-border bg-sidebar-accent/20">
         <div className="flex flex-col gap-1">
           <span className="text-[10px] text-sidebar-foreground/40 font-bold uppercase tracking-widest">Платформа</span>
           <span className="text-[11px] text-sidebar-foreground/60 font-medium font-bold">AltLinux SP 10 (ФСТЭК)</span>
         </div>
      </SidebarFooter>
    </Sidebar>
  )
}
