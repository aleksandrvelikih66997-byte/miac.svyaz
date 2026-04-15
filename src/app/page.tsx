
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Phone, 
  Users, 
  Clock, 
  ShieldCheck,
  ArrowRight
} from "lucide-react"

export default function Dashboard() {
  return (
    <div className="space-y-8">
      {/* Top row status cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "АКТИВНЫХ ЗВОНКОВ", value: "—", color: "border-t-primary" },
          { title: "ЗВОНКОВ СЕГОДНЯ", value: "—", color: "border-t-primary" },
          { title: "ОНЛАЙН АБОНЕНТОВ", value: "—", color: "border-t-green-500" },
          { title: "РОЛЬ ПОЛЬЗОВАТЕЛЯ", value: "—", color: "border-t-primary" },
        ].map((card, i) => (
          <Card key={i} className={`shadow-sm border-0 border-t-2 ${card.color} rounded-lg`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em]">
                {card.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tighter">—</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Middle row details */}
      <div className="grid gap-8 md:grid-cols-2">
        <Card className="shadow-sm border-0 rounded-lg overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50/50 py-4 px-6">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Phone className="h-4 w-4 text-rose-500" /> Активные звонки
            </CardTitle>
            <button className="text-[10px] font-bold text-primary flex items-center gap-1 uppercase tracking-wider hover:underline">
              все <ArrowRight className="h-3 w-3" />
            </button>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="flex items-center gap-3 text-muted-foreground">
              <div className="h-2 w-2 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <span className="text-sm font-medium">Загрузка...</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-0 rounded-lg overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50/50 py-4 px-6">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-500" /> Абоненты онлайн
            </CardTitle>
            <button className="text-[10px] font-bold text-primary flex items-center gap-1 uppercase tracking-wider hover:underline">
              все <ArrowRight className="h-3 w-3" />
            </button>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="flex items-center gap-3 text-muted-foreground">
              <div className="h-2 w-2 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <span className="text-sm font-medium">Загрузка...</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom row large card */}
      <Card className="shadow-sm border-0 rounded-lg overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50/50 py-4 px-6">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-400" /> Последние звонки
          </CardTitle>
          <button className="text-[10px] font-bold text-primary flex items-center gap-1 uppercase tracking-wider hover:underline">
            история <ArrowRight className="h-3 w-3" />
          </button>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="h-2 w-2 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <span className="text-sm font-medium">Загрузка...</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
