
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Phone, 
  Users, 
  Clock, 
  ShieldCheck,
  ArrowRight,
  Activity,
  Zap
} from "lucide-react"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { collection, query } from "firebase/firestore"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"

export default function Dashboard() {
  const db = useFirestore()
  
  const extensionsRef = useMemoFirebase(() => collection(db, "extensions"), [db]);
  const trunksRef = useMemoFirebase(() => collection(db, "trunks"), [db]);
  const routesRef = useMemoFirebase(() => collection(db, "routes"), [db]);

  const { data: extensions } = useCollection(extensionsRef)
  const { data: trunks } = useCollection(trunksRef)
  const { data: routes } = useCollection(routesRef)

  const stats = [
    { title: "АБОНЕНТОВ В БАЗЕ", value: extensions?.length || 0, color: "border-t-primary" },
    { title: "ОНЛАЙН", value: extensions?.filter(e => (e as any).status === 'online').length || 0, color: "border-t-emerald-500" },
    { title: "ПРАВИЛ МАРШРУТОВ", value: routes?.length || 0, color: "border-t-amber-500" },
    { title: "СИНХРОНИЗАЦИЯ", value: "АКТИВНА", color: "border-t-primary" },
  ]

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Обзор системы</h2>
        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
           <Zap className="h-3 w-3 fill-emerald-500 animate-pulse" />
           <span className="text-[10px] font-bold uppercase tracking-widest">Real-time Sync Active</span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <Card key={i} className={`shadow-sm border-0 border-t-2 ${stat.color} rounded-lg bg-card`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em]">
                {stat.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tighter">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <Card className="shadow-sm border-0 rounded-lg overflow-hidden border">
          <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20 py-4 px-6">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Activity className="h-4 w-4 text-rose-500" /> Состояние Asterisk
            </CardTitle>
            <Link href="/services" className="text-[10px] font-bold text-primary flex items-center gap-1 uppercase tracking-wider hover:underline">
              Управление <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="py-8">
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Версия:</span>
                <span className="font-mono font-medium">Asterisk 20.x (AltLinux SP)</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">AMI Статус:</span>
                <Badge className="bg-emerald-500">CONNECTED</Badge>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">PJSIP Transport:</span>
                <span className="font-mono font-medium text-emerald-600">UDP/5060 - ACTIVE</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-0 rounded-lg overflow-hidden border">
          <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20 py-4 px-6">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Статус абонентов
            </CardTitle>
            <Link href="/extensions" className="text-[10px] font-bold text-primary flex items-center gap-1 uppercase tracking-wider hover:underline">
              Все <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="py-6">
            <div className="space-y-3">
              {extensions?.slice(0, 5).map((ext: any) => (
                <div key={ext.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/10 group hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`h-2.5 w-2.5 rounded-full ${ext.status === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-300'}`} />
                    <span className="text-sm font-semibold">{ext.id}</span>
                    <span className="text-xs text-muted-foreground">{ext.name}</span>
                  </div>
                  {ext.dnd && <Badge variant="destructive" className="text-[8px] h-4">DND</Badge>}
                </div>
              ))}
              {(!extensions || extensions.length === 0) && (
                <div className="text-center text-muted-foreground text-sm py-8 italic">Абоненты не добавлены</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
