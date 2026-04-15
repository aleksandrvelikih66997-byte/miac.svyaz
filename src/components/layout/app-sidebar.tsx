
"use client"

import * as React from "react"
import { 
  Activity, 
  Users, 
  Settings, 
  GitBranch, 
  Terminal, 
  Wand2, 
  PhoneCall,
  LayoutDashboard
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
  SidebarRail,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar"

const navigation = [
  { name: "Рабочий стол", href: "/", icon: LayoutDashboard },
  { name: "Экстеншены", href: "/extensions", icon: Users },
  { name: "Транки", href: "/trunks", icon: Settings },
  { name: "Маршрутизация", href: "/routing", icon: GitBranch },
  { name: "Службы Asterisk", href: "/services", icon: Terminal },
  { name: "ИИ Помощник", href: "/ai-assistant", icon: Wand2 },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <PhoneCall className="h-5 w-5" />
          </div>
          <div className="flex flex-col gap-0.5 leading-none">
            <span className="font-headline font-semibold text-primary">АльтернаТИВ АТС</span>
            <span className="text-[10px] text-muted-foreground">Asterisk 17 (AltLinux)</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 font-headline uppercase tracking-wider text-muted-foreground/70">
            Навигация
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.name}
                    className="px-4"
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span className="font-medium">{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
