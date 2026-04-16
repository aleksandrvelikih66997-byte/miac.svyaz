
"use client"

import { useState } from "react"
import { 
  Play, 
  RotateCcw, 
  Square, 
  Terminal, 
  Trash2,
  RefreshCw,
  Settings2,
  FileCode,
  Download
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"
import { useCollection, useFirestore } from "@/firebase"
import { collection } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"

export default function ServicesPage() {
  const [status, setStatus] = useState<'running' | 'stopped' | 'restarting'>('running')
  const [logs, setLogs] = useState([
    "[SYSTEM] AMI miac connected from 127.0.0.1",
    "[PJSIP] Loading transport-udp...",
    "[CONFIG] Reading extensions.conf [from-internal]"
  ])
  const db = useFirestore()
  const { data: extensions } = useCollection(collection(db, "extensions"))
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
    if (!extensions) return
    const content = extensions.map(ext => `
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
    toast({ title: "Файл сгенерирован", description: "pjsip_miac_users.conf готов к загрузке" })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-headline font-bold">Управление системой</h2>
          <p className="text-sm text-muted-foreground">Статус asterisk.service и экспорт конфигураций</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={status === 'running' ? 'default' : 'destructive'} className={status === 'running' ? 'bg-emerald-500' : ''}>
            {status === 'running' ? 'Active (Running)' : status === 'restarting' ? 'Reloading...' : 'Stopped'}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="col-span-1 border-none shadow-sm h-fit">
          <CardHeader>
            <CardTitle className="text-lg">Инструменты</CardTitle>
            <CardDescription>Синхронизация с сервером</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full justify-start gap-3" variant="outline" onClick={generatePJSIPFile}>
              <FileCode className="h-4 w-4 text-primary" /> Экспорт PJSIP_MIAC
            </Button>
            <Button className="w-full justify-start gap-3" variant="outline">
              <Download className="h-4 w-4" /> Бэкап AstDB
            </Button>
            
            <div className="pt-4 mt-4 border-t space-y-2">
              <Label className="text-[10px] text-muted-foreground uppercase">Управление службой</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button size="icon" variant="outline" className="w-full" onClick={() => handleAction('running')} disabled={status === 'running'}>
                  <Play className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" className="w-full" onClick={() => handleAction('restarting')}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="destructive" className="w-full" onClick={() => handleAction('stopped')} disabled={status === 'stopped'}>
                  <Square className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="pt-4 space-y-3">
              <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground text-xs">
                <RefreshCw className="h-3 w-3" /> Core Reload
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground text-xs">
                <Settings2 className="h-3 w-3" /> AMI Settings
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-2 border-none shadow-sm flex flex-col h-[600px]">
          <CardHeader className="flex flex-row items-center justify-between shrink-0">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Terminal className="h-5 w-5 text-primary" /> Asterisk Full Log (AltLinux)
              </CardTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setLogs([])}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full bg-slate-950 p-4 border-t border-slate-800">
              <div className="space-y-1 font-mono text-[11px]">
                {logs.map((log, i) => (
                  <div key={i} className="text-slate-300">
                    <span className="text-slate-500 mr-2">[{new Date().toLocaleDateString()}]</span>
                    {log}
                  </div>
                ))}
                <div className="flex items-center gap-2 text-emerald-400">
                  <span className="animate-pulse">_</span>
                  <span>CLI Ready (miac connected)</span>
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
