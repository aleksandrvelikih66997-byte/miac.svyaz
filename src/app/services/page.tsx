
"use client"

import { useState } from "react"
import { 
  RotateCcw, 
  Square, 
  Terminal, 
  Trash2,
  RefreshCw,
  FileCode,
  ClipboardCheck,
  ShieldAlert,
  Server,
  AlertTriangle,
  Database,
  Zap,
  Play
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { collection, query } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function ServicesPage() {
  const [status, setStatus] = useState<'running' | 'stopped' | 'restarting'>('running')
  const [logs, setLogs] = useState([
    "[BRIDGE] Ожидание запуска скрипта на сервере...",
    "[SYSTEM] Служба Asterisk.service активна.",
  ])
  const db = useFirestore()
  
  const extensionsRef = useMemoFirebase(() => collection(db, "extensions"), [db]);
  const { data: extensions } = useCollection(extensionsRef)
  const { toast } = useToast()

  const handleAction = (newStatus: 'running' | 'stopped' | 'restarting') => {
    setStatus(newStatus)
    const time = new Date().toLocaleTimeString()
    setLogs(prev => [`[${time}] SYSTEM: Действие ${newStatus.toUpperCase()}`, ...prev])
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-primary">Синхронизация и Мостик</h2>
          <p className="text-sm text-muted-foreground">Автоматизация применения настроек из Web-панели</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-emerald-500 font-bold px-4 py-1">
            BRIDGE: ONLINE
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Alert className="bg-primary/5 border-primary/20">
            <Zap className="h-5 w-5 text-primary" />
            <AlertTitle className="font-bold">Как включить авто-применение?</AlertTitle>
            <AlertDescription className="text-xs mt-2 space-y-2">
              <p>Чтобы изменения из этой панели сразу попадали в Asterisk, запустите "Мостик" на вашем сервере AltLinux:</p>
              <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-[11px] mt-2 border shadow-inner">
                <p className="text-emerald-400"># 1. Перейдите в папку проекта</p>
                <p>cd /opt/miac-svyaz</p>
                <p className="text-emerald-400 mt-2"># 2. Запустите скрипт моста</p>
                <p>npm run bridge</p>
              </div>
              <p className="mt-2 text-muted-foreground italic">После запуска скрипта вам больше не нужно скачивать и загружать файлы вручную.</p>
            </AlertDescription>
          </Alert>

          <Card className="border-none shadow-xl flex flex-col h-[400px] overflow-hidden border">
            <CardHeader className="flex flex-row items-center justify-between shrink-0 bg-slate-900 text-white py-3">
              <div className="flex items-center gap-3">
                <Terminal className="h-4 w-4 text-emerald-400" />
                <span className="font-mono text-xs uppercase tracking-widest font-bold">Bridge Live Logs</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setLogs([])} className="h-8 w-8 hover:bg-slate-800 text-slate-400">
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden">
              <ScrollArea className="h-full bg-slate-950 p-6">
                <div className="space-y-1.5 font-mono text-[11px]">
                  {logs.map((log, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="text-slate-600 shrink-0">[{new Date().toLocaleTimeString()}]</span>
                      <span className={log.includes('ERROR') ? 'text-rose-400' : log.includes('BRIDGE') ? 'text-emerald-400' : 'text-slate-300'}>
                        {log}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Play className="h-4 w-4 text-primary" /> Быстрые команды
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full justify-start gap-3 bg-primary text-white" onClick={() => handleAction('restarting')}>
                <RefreshCw className="h-4 w-4" /> Core Reload
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3 border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => handleAction('stopped')}>
                <Square className="h-4 w-4" /> Stop Bridge
              </Button>
            </CardContent>
          </Card>

          <Alert className="bg-amber-50 border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-[10px] text-amber-800">
              Если "Мостик" не запущен, используйте кнопки экспорта ниже для ручного обновления.
            </AlertDescription>
          </Alert>

          <Card className="border shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <FileCode className="h-4 w-4 text-primary" /> Резервный экспорт
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="secondary" className="w-full justify-start gap-3 text-xs">
                <FileCode className="h-4 w-4" /> pjsip_miac_users.conf
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
