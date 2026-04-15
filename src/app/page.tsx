
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Activity, 
  PhoneIncoming, 
  PhoneOutgoing, 
  Cpu, 
  HardDrive,
  Users
} from "lucide-react"
import { 
  Bar, 
  BarChart, 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  Tooltip,
  Cell
} from "recharts"

const mockData = [
  { name: "08:00", calls: 12 },
  { name: "10:00", calls: 45 },
  { name: "12:00", calls: 32 },
  { name: "14:00", calls: 58 },
  { name: "16:00", calls: 48 },
  { name: "18:00", calls: 21 },
]

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm border-none bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Активные звонки</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">14</div>
            <p className="text-xs text-muted-foreground">+2 за последние 5 мин</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-none bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Входящие сегодня</CardTitle>
            <PhoneIncoming className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,284</div>
            <p className="text-xs text-muted-foreground">+18% от вчера</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-none bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Исходящие сегодня</CardTitle>
            <PhoneOutgoing className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">842</div>
            <p className="text-xs text-muted-foreground">+7% от вчера</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-none bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Онлайн линий</CardTitle>
            <Users className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">42/50</div>
            <p className="text-xs text-muted-foreground">84% емкости</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 shadow-sm border-none">
          <CardHeader>
            <CardTitle className="text-lg font-headline">Активность вызовов</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mockData}>
                  <XAxis 
                    dataKey="name" 
                    stroke="#888888" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="#888888" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(value) => `${value}`} 
                  />
                  <Tooltip 
                    cursor={{fill: 'hsl(var(--muted))'}}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="calls" radius={[4, 4, 0, 0]}>
                    {mockData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index % 2 === 0 ? "hsl(var(--primary))" : "hsl(var(--accent))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        
        <Card className="col-span-3 shadow-sm border-none">
          <CardHeader>
            <CardTitle className="text-lg font-headline">Состояние сервера</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Cpu className="h-5 w-5" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>Загрузка CPU</span>
                  <span>24%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: "24%" }} />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
                <Activity className="h-5 w-5" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>ОЗУ (RAM)</span>
                  <span>3.2 / 8 GB</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-accent" style={{ width: "40%" }} />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <HardDrive className="h-5 w-5" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>Диск</span>
                  <span>142 / 500 GB</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: "28%" }} />
                </div>
              </div>
            </div>
            
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Версия Asterisk</span>
                <span className="font-mono">17.9.4</span>
              </div>
              <div className="flex items-center justify-between text-xs mt-2">
                <span className="text-muted-foreground">Аптайм</span>
                <span>14д 6ч 22м</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
