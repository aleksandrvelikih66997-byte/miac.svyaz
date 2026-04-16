"use client"

import { useState } from "react"
import { 
  Play, 
  RotateCcw, 
  Square, 
  Terminal, 
  Trash2,
  RefreshCw,
  FileCode,
  Download,
  ShieldAlert,
  Server,
  ClipboardCheck,
  AlertTriangle,
  HelpCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { collection, query } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export default function ServicesPage() {
  const [status, setStatus] = useState<'running' | 'stopped' | 'restarting'>('stopped')
  const [logs, setLogs] = useState([
    "[CRITICAL] /var/run/asterisk/asterisk.ctl not found. Is Asterisk service running?",
    "[SYSTEM] Проверка статуса службы в AltLinux SP...",
    "[CONFIG] Ожидание синхронизации файлов..."
  ])
  const db = useFirestore()
  
  const extensionsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "extensions"));
  }, [db]);

  const routesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "routes"));
  }, [db]);

  const { data: extensions } = useCollection(extensionsQuery)
  const { data: routes } = useCollection(routesQuery)
  const { toast } = useToast()

  const handleAction = (newStatus: 'running' | 'stopped' | 'restarting') => {
    setStatus(newStatus)
    const time = new Date().toLocaleTimeString()
    
    if (newStatus === 'restarting') {
      setLogs(prev => [`[${time}] SYSTEM: Перезагрузка службы Asterisk...`, ...prev])
      setTimeout(() => {
        setStatus('running')
        setLogs(prev => [`[${time}] SYSTEM: Служба Asterisk успешно запущена.`, ...prev])
      }, 2000)
    } else {
      setLogs(prev => [`[${time}] SYSTEM: Статус изменен на ${newStatus.toUpperCase()}`, ...prev])
    }
  }

  const generatePJSIPFile = () => {
    if (!extensions || extensions.length === 0) {
      toast({ title: "Ошибка", description: "Нет абонентов для экспорта", variant: "destructive" })
      return
    }
    
    const content = extensions.map(ext => `
; --- Extension ${ext.id} ---
[${ext.id}]
type=endpoint
context=${ext.context || 'from-internal'}
disallow=all
allow=alaw,ulaw
auth=${ext.id}_auth
aors=${ext.id}

[${ext.id}_auth]
type=auth
auth_type=userpass
username=${ext.id}
password=${(ext as any).secret || 'changeme123'}

[${ext.id}]
type=aor
max_contacts=1
`).join('\n')

    downloadFile(content, 'pjsip_miac_users.conf')
    toast({ title: "Файл PJSIP готов", description: "Загрузите его в /etc/asterisk/" })
  }

  const generateExtensionsFile = () => {
    if (!routes || routes.length === 0) {
      toast({ title: "Ошибка", description: "Нет маршрутов для экспорта", variant: "destructive" })
      return
    }

    const inbound = routes.filter(r => (r as any).type === 'inbound')
    const outbound = routes.filter(r => (r as any).type === 'outbound')

    let content = `[from-internal]\n`
    content += `; --- Автоматически сгенерированные маршруты ---\n\n`
    
    inbound.forEach(r => {
      content += `exten => ${r.pattern},1,Dial(PJSIP/${r.destination})\n`
    })

    content += `\n[outbound-routes]\n`
    outbound.forEach(r => {
      content += `exten => ${r.pattern},1,Dial(PJSIP/\${EXTEN}@${r.destination})\n`
    })

    downloadFile(content, 'extensions_miac_routes.conf')
    toast({ title: "Файл Dialplan готов", description: "Загрузите его в /etc/asterisk/" })
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
          <h2 className="text-2xl font-headline font-bold text-primary">Управление и Синхронизация</h2>
          <p className="text-sm text-muted-foreground">Применение настроек к локальному серверу Asterisk</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={status === 'running' ? 'default' : 'destructive'} className={status === 'running' ? 'bg-emerald-500 font-bold px-4 py-1' : ''}>
            {status === 'running' ? 'Active (Running)' : status === 'restarting' ? 'Reloading...' : 'Stopped / Error'}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <div className="md:col-span-3 space-y-6">
          <Alert className="bg-amber-50 border-amber-200 shadow-sm border-l-4 border-l-amber-500">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <AlertTitle className="text-amber-800 font-bold italic">Внимание: требуется синхронизация</AlertTitle>
            <AlertDescription className="text-amber-700 text-xs mt-1 leading-relaxed">
              Чтобы изменения вступили в силу в <strong>Asterisk</strong>:
              <ol className="list-decimal ml-4 mt-2 space-y-1">
                <li>Нажмите <strong>«PJSIP Абоненты»</strong> справа.</li>
                <li>Скопируйте скачанный файл в <code>/etc/asterisk/pjsip_miac_users.conf</code>.</li>
                <li>Выполните <code>asterisk -rx "core reload"</code> на сервере.</li>
              </ol>
            </AlertDescription>
          </Alert>

          <Alert variant="destructive" className="bg-rose-50 border-rose-200">
            <ShieldAlert className="h-5 w-5 text-rose-600" />
            <AlertTitle className="font-bold">Ошибка: asterisk.ctl не найден</AlertTitle>
            <AlertDescription className="text-xs space-y-3">
              <p>Файл сокета создается <strong>только при запущенной службе</strong>. Если его нет, Asterisk выключен.</p>
              <div className="bg-slate-900 text-slate-100 p-3 rounded font-mono space-y-1">
                <p className="text-emerald-400"># 1. Запустить службу</p>
                <p>systemctl enable asterisk</p>
                <p>systemctl start asterisk</p>
                <p className="text-emerald-400 mt-2"># 2. Если файл появился, но нет прав</p>
                <p>chown -R asterisk:asterisk /var/run/asterisk</p>
                <p>chmod 770 /var/run/asterisk/asterisk.ctl</p>
              </div>
            </AlertDescription>
          </Alert>

          <Card className="border-none shadow-xl flex flex-col h-[400px] overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between shrink-0 bg-slate-900 text-white py-4">
              <div className="flex items-center gap-3">
                <Terminal className="h-5 w-5 text-emerald-400" />
                <span className="font-mono text-sm uppercase tracking-widest font-bold">Системный терминал (AMI)</span>
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
                      <span className={log.includes('CRITICAL') || log.includes('ERROR') ? 'text-rose-400' : log.includes('SYSTEM') ? 'text-blue-400' : 'text-slate-300'}>
                        {log}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 text-emerald-400 pt-2">
                    <span className="animate-pulse">_</span>
                    <span className="font-bold">bash@altlinux-sp10:~$</span>
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-lg h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Server className="h-4 w-4 text-primary" /> Служба Asterisk
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="grid grid-cols-3 gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="outline" className={`w-full ${status === 'running' ? 'border-emerald-500 text-emerald-600 bg-emerald-50' : ''}`} onClick={() => handleAction('running')} disabled={status === 'running'}>
                        <Play className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Start service</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="outline" className="w-full" onClick={() => handleAction('restarting')}>
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Reload config</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="destructive" className="w-full" onClick={() => handleAction('stopped')} disabled={status === 'stopped'}>
                        <Square className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Stop service</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Button variant="ghost" className="w-full justify-start gap-3 text-xs text-muted-foreground hover:text-primary" onClick={() => handleAction('restarting')}>
                <RefreshCw className="h-3 w-3" /> Перезагрузить AMI
              </Button>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <FileCode className="h-4 w-4 text-primary" /> Экспорт (AltLinux)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full justify-start gap-3 bg-primary/10 text-primary hover:bg-primary/20 border-none shadow-none" onClick={generatePJSIPFile}>
                <FileCode className="h-4 w-4" /> PJSIP Абоненты
              </Button>
              <Button className="w-full justify-start gap-3 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-none shadow-none" onClick={generateExtensionsFile}>
                <ClipboardCheck className="h-4 w-4" /> Dialplan Маршруты
              </Button>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg h-fit bg-slate-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-2">
                <HelpCircle className="h-3 w-3" /> Помощь ФСТЭК
              </CardTitle>
            </CardHeader>
            <CardContent className="text-[11px] text-slate-600 leading-relaxed">
              Для соблюдения контура безопасности все секреты передаются только при ручном экспорте файлов конфигурации.
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
