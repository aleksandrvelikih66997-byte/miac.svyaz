
"use client"

import * as React from "react"
import { 
  Users, 
  Settings, 
  History, 
  Database, 
  LayoutDashboard,
  LogOut,
  ChevronRight
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
      { name: "История", href: "/history", icon: History },
    ]
  },
  {
    label: "Телефония",
    items: [
      { name: "Транки", href: "/trunks", icon: Database },
    ]
  },
  {
    label: "Система",
    items: [
      { name: "Настройки", href: "/services", icon: Settings },
    ]
  }
]

export function AppSidebar() {
  const pathname = usePathname()
  const { user } = useUser()

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-primary/50 text-sidebar-foreground">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div className="flex flex-col gap-0">
            <span className="font-bold text-lg tracking-tight leading-none">МИАЦ.СВЯЗЬ</span>
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground mt-1 opacity-70">Управление телефонией</span>
          </div>
        </div>
        <div className="px-1 mt-4">
          <span className="text-[10px] text-muted-foreground/60 font-mono">v2.0 • ALT SP10 • Asterisk 20</span>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="px-2">
        {groups.map((group) => (
          <SidebarGroup key={group.label} className="py-4">
            <SidebarGroupLabel className="px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50 mb-2">
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
                      className="px-4 py-6 transition-all data-[active=true]:bg-primary/90 data-[active=true]:text-white hover:bg-sidebar-accent"
                    >
                      <Link href={item.href} className="flex items-center gap-3">
                        <item.icon className="h-5 w-5" />
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

      <SidebarFooter className="p-0 border-t border-sidebar-border bg-sidebar-accent/30">
        <div className="flex items-center gap-3 p-4">
          <Avatar className="h-10 w-10 border border-primary/20">
            <AvatarImage src="" />
            <AvatarFallback className="bg-primary text-white text-xs font-bold">АД</AvatarFallback>
          </Avatar>
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-semibold truncate leading-none">Администратор</span>
            <span className="text-[10px] text-muted-foreground mt-1">загрузка...</span>
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
