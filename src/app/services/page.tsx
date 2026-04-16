
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
  Database
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
    "[SYSTEM] Служба Asterisk.service активна и работает.",
    "[NOTICE] Эндпоинт 123 зарегистрирован с 192.168.0.54",
    "[WARNING] Обнаружен DND статус в AstDB для номера 100",
    "[CONFIG] Требуется синхронизация pjsip_miac_users.conf"
  ])
  const db = useFirestore()
  
  const extensionsRef = useMemoFirebase(() => collection(db, "extensions"), [db]);
  const routesRef = useMemoFirebase(() => collection(db, "routes"), [db]);

  const { data: extensions } = useCollection(extensionsRef)
  const { data: routes } = useCollection(routesRef)
  const { toast } = useToast()

  const handleAction = (newStatus: 'running' | 'stopped' | 'restarting') => {
    setStatus(newStatus)
    const time = new Date().toLocaleTimeString()
    
    if (newStatus === 'restarting') {
      setLogs(prev => [`[${time}] SYSTEM: Перезагрузка ядра (core reload)...`, ...prev])
      setTimeout(() => {
        setStatus('running')
        setLogs(prev => [`[${time}] SYSTEM: Конфигурация успешно обновлена.`, ...prev])
      }, 1500)
    } else {
      setLogs(prev => [`[${time}] SYSTEM: Статус службы изменен на ${newStatus.toUpperCase()}`, ...prev])
    }
  }

  const generatePJSIPFile = () => {
    if (!extensions || extensions.length === 0) {
      toast({ title: "Ошибка", description: "В базе нет абонентов для экспорта", variant: "destructive" })
      return
    }
    
    const content = extensions.map(ext => `
; --- Абонент ${ext.id}: ${ext.name} ---
[${ext.id}]
type=endpoint
context=${(ext as any).context || 'from-internal'}
disallow=all
allow=alaw,ulaw
auth=${ext.id}_auth
aors=${ext.id}
transport=transport-udp

[${ext.id}_auth]
type=auth
auth_type=userpass
username=${ext.id}
password=${(ext as any).secret || 'MiacPass2024'}

[${ext.id}]
type=aor
max_contacts=1
`).join('\n')

    downloadFile(content, 'pjsip_miac_users.conf')
    toast({ 
      title: "Конфигурация готова", 
      description: "Файл pjsip_miac_users.conf скачан. Переместите его в /etc/asterisk/",
    })
  }

  const generateExtensionsFile = () => {
    let content = `[from-internal]\n`
    content += `; --- Автоматические правила МИАЦ ---\n\n`
    
    if (routes) {
      routes.filter(r => (r as any).type === 'inbound').forEach(r => {
        content += `exten => ${r.pattern},1,Dial(PJSIP/${r.destination},30)\n`
      })
    }
    
    content += `\n; Базовая логика с проверкой DND\n`
    content += `exten => _XXX,1,NoOp(Call to $\{EXTEN\})\n`
    content += ` same => n,Set(DND_STATUS=$\{DB(DND/$\{EXTEN\})\})\n`
    content += ` same => n,GotoIf($["$\{DND_STATUS\}" = "YES"]?dnd)\n`
    content += ` same => n,Dial(PJSIP/$\{EXTEN\},30)\n`
    content += ` same => n,Hangup()\n`
    content += ` same => n(dnd),Answer()\n`
    content += ` same => n,Playback(do-not-disturb)\n`
    content += ` same => n,Hangup()\n`

    downloadFile(content, 'extensions_miac_routes.conf')
    toast({ title: "Диалплан готов", description: "Загрузите его в /etc/asterisk/" })
  }

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-headline font-bold text-primary">Синхронизация с Asterisk</h2>
          <p className="text-sm text-muted-foreground">Применение настроек и решение проблем DND/Статусов</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={status === 'running' ? 'default' : 'destructive'} className={status === 'running' ? 'bg-emerald-500 font-bold px-4 py-1' : ''}>
            {status === 'running' ? 'ASTERISK: ACTIVE' : 'SERVICE STATUS'}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <div className="md:col-span-3 space-y-6">
          <Alert className="bg-amber-50 border-amber-200 border-l-4 border-l-amber-500">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <AlertTitle className="text-amber-800 font-bold">Проблема: Номер всегда занят (DND YES)</AlertTitle>
            <AlertDescription className="text-amber-700 text-xs mt-1 leading-relaxed">
              Если при звонке на номер (например, 100) вы слышите «Не беспокоить», значит в базе Asterisk (AstDB) установлена метка. 
              <div className="bg-slate-900 text-slate-100 p-3 rounded mt-2 font-mono text-[10px]">
                # Чтобы сбросить DND для номера 100 в консоли Asterisk:<br/>
                asterisk -rx "database del DND 100"
              </div>
            </AlertDescription>
          </Alert>

          <Card className="border-none shadow-xl flex flex-col h-[400px] overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between shrink-0 bg-slate-900 text-white py-4">
              <div className="flex items-center gap-3">
                <Terminal className="h-5 w-5 text-emerald-400" />
                <span className="font-mono text-sm uppercase tracking-widest font-bold">Asterisk Console Log</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setLogs([])} className="hover:bg-slate-800 text-slate-400">
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden">
              <ScrollArea className="h-full bg-slate-950 p-6">
                <div className="space-y-1.5 font-mono text-[11px]">
                  {logs.map((log, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="text-slate-600 shrink-0">[{new Date().toLocaleTimeString()}]</span>
                      <span className={log.includes('WARNING') ? 'text-amber-400' : log.includes('NOTICE') ? 'text-emerald-400' : 'text-slate-300'}>
                        {log}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Alert className="bg-blue-50 border-blue-200 border-l-4 border-l-blue-500">
            <Database className="h-5 w-5 text-blue-600" />
            <AlertTitle className="text-blue-800 font-bold">Как сделать статусы автоматическими?</AlertTitle>
            <AlertDescription className="text-blue-700 text-xs mt-1 leading-relaxed">
              Чтобы статусы (Online/Offline) в интерфейсе обновлялись сами, необходимо запустить скрипт-прослойку на сервере AltLinux, который будет пересылать события AMI в Firestore.
            </AlertDescription>
          </Alert>
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-lg h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-primary" /> Действия
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full justify-start gap-3 bg-primary text-white hover:bg-primary/90" onClick={() => handleAction('restarting')}>
                <RotateCcw className="h-4 w-4" /> Core Reload
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3 text-destructive" onClick={() => handleAction('stopped')}>
                <Square className="h-4 w-4" /> Stop Service
              </Button>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <FileCode className="h-4 w-4 text-primary" /> Экспорт
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full justify-start gap-3 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-none" onClick={generatePJSIPFile}>
                <FileCode className="h-4 w-4" /> PJSIP Абоненты
              </Button>
              <Button className="w-full justify-start gap-3 bg-slate-100 text-slate-700 hover:bg-slate-200 border-none" onClick={generateExtensionsFile}>
                <ClipboardCheck className="h-4 w-4" /> Dialplan + DND
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
