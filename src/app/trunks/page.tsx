
"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Globe, ShieldCheck, Wifi, MoreVertical, ExternalLink } from "lucide-react"

const trunks = [
  { id: 1, name: "Beeline-Main", host: "sip.beeline.ru", user: "74951234567", status: "Registered", channels: "0/10" },
  { id: 2, name: "Rostelecom-Backup", host: "sip.rt.ru", user: "74997654321", status: "Registered", channels: "0/5" },
  { id: 3, name: "Zadarma-International", host: "sip.zadarma.com", user: "123456", status: "Unregistered", channels: "0/2" },
]

export default function TrunksPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-headline font-bold">Транки (SIP/PJSIP)</h2>
          <p className="text-sm text-muted-foreground">Настройка внешних линий и провайдеров</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Добавить транк
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {trunks.map((trunk) => (
          <Card key={trunk.id} className="border-none shadow-sm overflow-hidden group">
            <CardHeader className="bg-muted/30 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Globe className="h-5 w-5" />
                </div>
                <Badge variant={trunk.status === "Registered" ? "default" : "destructive"} className={trunk.status === "Registered" ? "bg-emerald-500 hover:bg-emerald-600" : ""}>
                  {trunk.status === "Registered" ? "Активен" : "Ошибка"}
                </Badge>
              </div>
              <CardTitle className="pt-4 text-lg font-headline">{trunk.name}</CardTitle>
              <CardDescription className="font-mono text-xs">{trunk.host}</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5"><ShieldCheck className="h-3 w-3" /> Пользователь:</span>
                  <span className="font-medium">{trunk.user}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Wifi className="h-3 w-3" /> Каналы:</span>
                  <span className="font-medium">{trunk.channels}</span>
                </div>
              </div>
              
              <div className="pt-4 border-t flex items-center justify-between">
                <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
                  Настройки <ExternalLink className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
