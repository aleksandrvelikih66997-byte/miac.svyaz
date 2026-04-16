
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Users, 
  ArrowRight,
  Activity,
  Zap,
  PhoneCall
} from "lucide-react"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { collection, query } from "firebase/firestore"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"

export default function Dashboard() {
  const db = useFirestore()
  
  const extensionsRef = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, "extensions");
  }, [db]);
  
  const trunksRef = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, "trunks");
  }, [db]);
  
  const routesRef = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, "routes");
  }, [db]);

  const { data: extensions } = useCollection(extensionsRef)
  const { data: trunks } = useCollection(trunksRef)
  const { data: routes } = useCollection(routesRef)

  const onlineCount = extensions?.filter(e => (e as any).status === 'online').length || 0;

  const stats = [
    { title: "АБОНЕНТОВ В БАЗЕ", value: extensions?.length || 0, color: "border-t-primary" },
    { title: "ОНЛАЙН (AMI)", value: onlineCount, color: onlineCount > 0 ? "border-t-emerald-500" : "border-t-slate-300" },
    { title: "ТРАНКОВ", value: trunks?.length || 0, color: "border-t-amber-500" },
    { title: "МАРШРУТОВ", value: routes?.length || 0, color: "border-t-accent" },
  ]

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Обзор МИАЦ.СВЯЗЬ</h2>
          <p className="text-muted-foreground mt-1">Реальное состояние телефонии на базе AltLinux SP</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100 shadow-sm">
           <Zap className="h-3 w-3 fill-emerald-500 animate-pulse" />
           <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Bridge Active</span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <Card key={i} className={`shadow-md border-0 border-t-4 ${stat.color} rounded-xl bg-card transition-all hover:shadow-lg`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em]">
                {stat.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black tracking-tighter text-primary">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <Card className="shadow-xl border-none rounded-2xl overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b bg-primary/5 py-4 px-6">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
              <Activity className="h-4 w-4 text-rose-500" /> Состояние Asterisk
            </CardTitle>
            <Link href="/services" className="text-[10px] font-bold text-primary flex items-center gap-1 uppercase tracking-wider hover:underline">
              Мониторинг <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="py-8 px-8">
            <div className="space-y-6">
              <div className="flex justify-between items-center text-sm p-4 bg-muted/20 rounded-xl">
                <span className="text-muted-foreground font-medium">Версия ядра:</span>
                <span className="font-mono font-bold text-primary">Asterisk 20.x (Alt SP10)</span>
              </div>
              <div className="flex justify-between items-center text-sm p-4 bg-muted/20 rounded-xl">
                <span className="text-muted-foreground font-medium">AMI Коннектор:</span>
                <Badge className="bg-emerald-500 text-white border-none px-3 py-1">CONNECTED</Badge>
              </div>
              <div className="flex justify-between items-center text-sm p-4 bg-muted/20 rounded-xl">
                <span className="text-muted-foreground font-medium">Синхронизация:</span>
                <span className="font-mono font-bold text-emerald-600">{"WEB -> PJSIP (AUTO)"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xl border-none rounded-2xl overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b bg-primary/5 py-4 px-6">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
              <PhoneCall className="h-4 w-4 text-accent" /> Активные абоненты
            </CardTitle>
            <Link href="/extensions" className="text-[10px] font-bold text-primary flex items-center gap-1 uppercase tracking-wider hover:underline">
              Все номера <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="py-6 px-6">
            <div className="space-y-3">
              {extensions?.slice(0, 5).map((ext: any) => (
                <div key={ext.id} className="flex items-center justify-between p-4 rounded-xl border bg-card hover:bg-muted/5 transition-all group shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className={`h-3 w-3 rounded-full ${ext.status === 'online' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-300'}`} />
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-primary">{ext.id}</span>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">{ext.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {ext.dnd && <Badge variant="destructive" className="text-[8px] px-1.5 h-4 font-black">DND</Badge>}
                    <span className={`text-[9px] uppercase font-black tracking-widest ${ext.status === 'online' ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {ext.status || 'offline'}
                    </span>
                  </div>
                </div>
              ))}
              {(!extensions || extensions.length === 0) && (
                <div className="text-center text-muted-foreground text-sm py-12 italic opacity-50">Абоненты не найдены</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
