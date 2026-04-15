"use client"

import * as React from "react"
import { 
  Users, 
  Settings, 
  History, 
  Database, 
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Phone
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useUser } from "@/firebase"

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarFooter,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

const groups = [
  {
    label: "Основное",
    items: [
      { name: "Дашборд", href: "/", icon: LayoutDashboard },
      { name: "Абоненты", href: "/extensions", icon: Users },
      { name: "Маршрутизация", href: "/routing", icon: Phone },
      { name: "История", href: "/history", icon: History },
    ]
  },
  {
    label: "Телефония",
    items: [
      { name: "Транки", href: "/trunks", icon: Database },
      { name: "ИИ Помощник", href: "/ai-assistant", icon: ShieldCheck },
    ]
  },
  {
    label: "Система",
    items: [
      { name: "Управление", href: "/services", icon: Settings },
    ]
  }
]

export function AppSidebar() {
  const pathname = usePathname()
  const { user } = useUser()

  return (
    <Sidebar collapsible="icon" className="border-r-0 bg-sidebar">
      <SidebarHeader className="px-6 py-6 border-b border-sidebar-border/50">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white shadow-lg">
            <Phone className="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-0 overflow-hidden">
            <span className="font-bold text-lg tracking-tight leading-none text-sidebar-foreground">МИАЦ.СВЯЗЬ</span>
            <span className="text-[9px] uppercase tracking-wider text-sidebar-foreground/60 mt-1 opacity-70 truncate">Система управления АТС</span>
          </div>
        </div>
        <div className="px-1 mt-4">
          <span className="text-[10px] text-sidebar-foreground/40 font-mono">v2.0 • ALT SP10 • Asterisk 20</span>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="px-2 scrollbar-none">
        {groups.map((group) => (
          <SidebarGroup key={group.label} className="py-2">
            <SidebarGroupLabel className="px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-sidebar-foreground/30 mb-2">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.href}
                      tooltip={item.name}
                      className="px-4 py-6 transition-all data-[active=true]:bg-primary data-[active=true]:text-white hover:bg-sidebar-accent group"
                    >
                      <Link href={item.href} className="flex items-center gap-3">
                        <item.icon className={`h-5 w-5 ${pathname === item.href ? 'text-white' : 'text-sidebar-foreground/60 group-hover:text-sidebar-foreground'}`} />
                        <span className="font-medium text-sm">{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-0 border-t border-sidebar-border bg-sidebar-accent/20">
        <div className="flex items-center gap-3 p-4">
          <Avatar className="h-10 w-10 border border-primary/20 shadow-sm">
            <AvatarImage src="" />
            <AvatarFallback className="bg-primary text-white text-xs font-bold">АД</AvatarFallback>
          </Avatar>
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-semibold truncate leading-none text-sidebar-foreground">Александр</span>
            <span className="text-[10px] text-sidebar-foreground/50 mt-1 truncate">{user?.email || 'администратор'}</span>
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
