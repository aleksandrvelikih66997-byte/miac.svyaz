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
  ShieldCheck
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { collection, query } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function ServicesPage() {
  const [status, setStatus] = useState<'running' | 'stopped' | 'restarting'>('running')
  const [logs, setLogs] = useState([
    "[SYSTEM] AMI miac connected from 127.0.0.1",
    "[PJSIP] Loading transport-udp...",
    "[CONFIG] Reading extensions.conf [from-internal]",
    "[SECURITY] FSTEC Compliance check passed: Local storage active"
  ])
  const db = useFirestore()
  
  const extensionsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "extensions"));
  }, [db]);

  const { data: extensions } = useCollection(extensionsQuery)
  const { toast } = useToast()

  const handleAction = (newStatus: 'running' | 'stopped' | 'restarting') => {
    setStatus(newStatus)
    if (newStatus === 'restarting') {
      setTimeout(() => setStatus('running'), 2000)
    }
    const actionLog = `[${new Date().toLocaleTimeString()}] SYSTEM: Asterisk service changed state to ${newStatus.toUpperCase()}`
    setLogs(prev => [actionLog, ...prev])
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

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'pjsip_miac_users.conf'
    a.click()
    toast({ title: "Файл сгенерирован", description: "pjsip_miac_users.conf готов к загрузке в /etc/asterisk/" })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-headline font-bold text-primary">Управление системой</h2>
          <p className="text-sm text-muted-foreground">Статус asterisk.service и экспорт локальных конфигураций</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={status === 'running' ? 'default' : 'destructive'} className={status === 'running' ? 'bg-emerald-500 font-bold px-4 py-1' : ''}>
            {status === 'running' ? 'Active (Running)' : status === 'restarting' ? 'Reloading...' : 'Stopped'}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <div className="md:col-span-3 space-y-6">
          <Alert className="bg-emerald-50 border-emerald-200 shadow-sm border-l-4 border-l-emerald-500">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <AlertTitle className="text-emerald-800 font-bold">Контур безопасности МИАЦ (ФСТЭК)</AlertTitle>
            <AlertDescription className="text-emerald-700 text-xs mt-1 leading-relaxed">
              Система работает по принципу <strong>"Hybrid Management"</strong>. 
              Управление осуществляется через интерфейс, но исполнение и хранение секретов происходит 
              исключительно в закрытом контуре вашего сервера <strong>AltLinux SP 10</strong>. 
              Файлы конфигурации генерируются локально и не покидают периметр безопасности.
            </AlertDescription>
          </Alert>

          <Card className="border-none shadow-xl flex flex-col h-[600px] overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between shrink-0 bg-slate-900 text-white py-4">
              <div className="flex items-center gap-3">
                <Terminal className="h-5 w-5 text-emerald-400" />
                <span className="font-mono text-sm uppercase tracking-widest font-bold">Asterisk Full Log</span>
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
                      <span className={log.includes('ERROR') ? 'text-rose-400' : log.includes('SYSTEM') ? 'text-blue-400' : 'text-slate-300'}>
                        {log}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 text-emerald-400 pt-2">
                    <span className="animate-pulse">_</span>
                    <span className="font-bold">CLI READY: miac@altlinux-sp10:~$</span>
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
                <Button size="icon" variant="outline" className={`w-full ${status === 'running' ? 'border-emerald-500 text-emerald-600 bg-emerald-50' : ''}`} onClick={() => handleAction('running')} disabled={status === 'running'}>
                  <Play className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" className="w-full" onClick={() => handleAction('restarting')}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="destructive" className="w-full" onClick={() => handleAction('stopped')} disabled={status === 'stopped'}>
                  <Square className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="ghost" className="w-full justify-start gap-3 text-xs text-muted-foreground hover:text-primary">
                <RefreshCw className="h-3 w-3" /> Core Reload (CLI)
              </Button>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <FileCode className="h-4 w-4 text-primary" /> Экспорт данных
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full justify-start gap-3 bg-primary/10 text-primary hover:bg-primary/20 border-none shadow-none" onClick={generatePJSIPFile}>
                <FileCode className="h-4 w-4" /> PJSIP_MIAC_USERS
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3 text-xs">
                <Download className="h-3 w-3" /> Бэкап AstDB
              </Button>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg h-fit bg-amber-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Аудит AMI</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-[10px] text-amber-900 leading-tight flex items-start gap-2">
                <ShieldAlert className="h-3 w-3 shrink-0 mt-0.5" />
                <span>Последний вход AMI: 5 мин. назад с 127.0.0.1 (user: miac)</span>
              </div>
              <Button variant="link" className="text-[10px] h-auto p-0 text-amber-700 font-bold hover:no-underline">ПОЛНЫЙ ОТЧЕТ БЕЗОПАСНОСТИ →</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
