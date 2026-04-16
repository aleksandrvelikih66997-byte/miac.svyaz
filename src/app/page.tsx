
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, ArrowRight, Activity, Zap, PhoneCall } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { getExtensions, getTrunks, getRoutes } from "@/lib/telephony-store"

export default function Dashboard() {
  const [stats, setStats] = useState({ extensions: 0, online: 0, trunks: 0, routes: 0 })
  const [recentExt, setRecentExt] = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
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
    }
    load()
  }, [])

  const statCards = [
    { title: "АБОНЕНТОВ", value: stats.extensions, color: "border-t-primary" },
    { title: "ОНЛАЙН", value: stats.online, color: "border-t-emerald-500" },
    { title: "ТРАНКОВ", value: stats.trunks, color: "border-t-amber-500" },
    { title: "МАРШРУТОВ", value: stats.routes, color: "border-t-accent" },
  ]

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-primary">Обзор МИАЦ.СВЯЗЬ</h2>
          <p className="text-muted-foreground mt-1">Автономный режим (Локальное хранилище)</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
           <Zap className="h-3 w-3 fill-emerald-500" />
           <span className="text-[10px] font-bold uppercase">Local Storage Active</span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, i) => (
          <Card key={i} className={`shadow-md border-0 border-t-4 ${stat.color} rounded-xl bg-card`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase">{stat.title}</CardTitle>
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
              <Activity className="h-4 w-4 text-rose-500" /> Состояние системы
            </CardTitle>
          </CardHeader>
          <CardContent className="py-8 px-8 space-y-4">
            <div className="flex justify-between items-center text-sm p-4 bg-muted/20 rounded-xl">
              <span>Режим работы:</span>
              <Badge className="bg-blue-500">CLOSED CIRCUIT</Badge>
            </div>
            <div className="flex justify-between items-center text-sm p-4 bg-muted/20 rounded-xl">
              <span>Хранилище:</span>
              <span className="font-mono font-bold">src/data/*.json</span>
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
              {recentExt.map((ext: any) => (
                <div key={ext.id} className="flex items-center justify-between p-4 rounded-xl border bg-card">
                  <div className="flex items-center gap-4">
                    <div className={`h-3 w-3 rounded-full ${ext.status === 'online' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <span className="text-sm font-black text-primary">{ext.id} - {ext.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
