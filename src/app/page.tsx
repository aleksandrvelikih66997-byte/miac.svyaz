"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, Zap, PhoneCall, ShieldCheck, Database, LayoutDashboard } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getExtensions, getTrunks, getRoutes } from "@/lib/telephony-store"

export default function Dashboard() {
  const [stats, setStats] = useState({ extensions: 0, online: 0, trunks: 0, routes: 0 })
  const [recentExt, setRecentExt] = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        const exts = await getExtensions()
        const trunks = await getTrunks()
        const routes = await getRoutes()
        
        setStats({
          extensions: exts.length,
          online: exts.filter((e: any) => e.status === 'online').length,
          trunks: trunks.length,
          routes: routes.length
        })
        setRecentExt(exts.slice(0, 5))
      } catch (err) {
        console.error("Failed to load dashboard stats", err)
      }
    }
    load()
    // Обновляем раз в 10 секунд
    const interval = setInterval(load, 10000)
    return () => clearInterval(interval)
  }, [])

  const statCards = [
    { title: "АБОНЕНТОВ", value: stats.extensions, color: "border-t-primary", icon: PhoneCall },
    { title: "ОНЛАЙН", value: stats.online, color: "border-t-emerald-500", icon: Activity },
    { title: "ТРАНКОВ", value: stats.trunks, color: "border-t-amber-500", icon: Database },
    { title: "МАРШРУТОВ", value: stats.routes, color: "border-t-accent", icon: Zap },
  ]

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-primary">Обзор МИАЦ.СВЯЗЬ</h2>
          <p className="text-muted-foreground mt-1">Автономный режим (Локальное хранилище данных)</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
           <Zap className="h-3 w-3 fill-emerald-500" />
           <span className="text-[10px] font-bold uppercase">Local Storage Active</span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, i) => (
          <Card key={i} className={`shadow-md border-0 border-t-4 ${stat.color} rounded-xl bg-card`}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase">{stat.title}</CardTitle>
              <stat.icon className="h-3 w-3 text-muted-foreground/40" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-primary">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <Card className="shadow-xl border-none rounded-2xl overflow-hidden">
          <CardHeader className="border-b bg-primary/5 py-4 px-6">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" /> Состояние системы
            </CardTitle>
          </CardHeader>
          <CardContent className="py-8 px-8 space-y-4">
            <div className="flex justify-between items-center text-sm p-4 bg-muted/20 rounded-xl">
              <span className="font-medium">Режим работы:</span>
              <Badge className="bg-blue-600">CLOSED CIRCUIT</Badge>
            </div>
            <div className="flex justify-between items-center text-sm p-4 bg-muted/20 rounded-xl">
              <span className="font-medium">Хранилище:</span>
              <span className="font-mono font-bold text-primary">src/data/*.json</span>
            </div>
            <div className="flex justify-between items-center text-sm p-4 bg-muted/20 rounded-xl">
              <span className="font-medium">Asterisk Integration:</span>
              <Badge variant="outline" className="border-emerald-500 text-emerald-600 font-bold">ACTIVE</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xl border-none rounded-2xl overflow-hidden">
          <CardHeader className="border-b bg-primary/5 py-4 px-6">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
              <PhoneCall className="h-4 w-4 text-accent" /> Последние номера
            </CardTitle>
          </CardHeader>
          <CardContent className="py-6 px-6">
            <div className="space-y-3">
              {recentExt.length > 0 ? recentExt.map((ext: any) => (
                <div key={ext.id} className="flex items-center justify-between p-4 rounded-xl border bg-card hover:bg-muted/5 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`h-3 w-3 rounded-full ${ext.status === 'online' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <span className="text-sm font-black text-primary">{ext.id} — {ext.name}</span>
                  </div>
                </div>
              )) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Нет добавленных абонентов
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
