
"use client"

import { useState, useEffect } from "react"
import { 
  Play, 
  RotateCcw, 
  Square, 
  Terminal, 
  Search, 
  Trash2,
  RefreshCw,
  Settings2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

const initialLogs = [
  "[2023-10-27 10:20:05] VERBOSE[1234] chan_pjsip.c: Registered SIP extension 101",
  "[2023-10-27 10:21:12] NOTICE[1234] loader.c: Reloading module 'app_voicemail.so'...",
  "[2023-10-27 10:22:45] VERBOSE[5678] pbx.c: Executing [79991234567@from-internal:1] Dial(\"PJSIP/101-0000000a\", \"PJSIP/trunk-beeline/79991234567\")",
  "[2023-10-27 10:23:01] WARNING[1234] res_pjsip_outbound_registration.c: No response from registrar at sip.beeline.ru",
  "[2023-10-27 10:25:30] VERBOSE[9012] app_dial.c: PJSIP/trunk-beeline-0000000b is ringing",
]

export default function ServicesPage() {
  const [status, setStatus] = useState<'running' | 'stopped' | 'restarting'>('running')
  const [logs, setLogs] = useState(initialLogs)

  const handleAction = (newStatus: 'running' | 'stopped' | 'restarting') => {
    setStatus(newStatus)
    if (newStatus === 'restarting') {
      setTimeout(() => setStatus('running'), 2000)
    }
    const actionLog = `[${new Date().toLocaleTimeString()}] SYSTEM: Asterisk service changed state to ${newStatus.toUpperCase()}`
    setLogs(prev => [actionLog, ...prev])
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-headline font-bold">Управление службами</h2>
          <p className="text-sm text-muted-foreground">Системный статус Asterisk и журналы событий</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={status === 'running' ? 'default' : 'destructive'} className={status === 'running' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}>
            {status === 'running' ? 'Запущено' : status === 'restarting' ? 'Перезагрузка...' : 'Остановлено'}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="col-span-1 border-none shadow-sm h-fit">
          <CardHeader>
            <CardTitle className="text-lg">Действия</CardTitle>
            <CardDescription>Управление демоном asterisk.service</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              className="w-full justify-start gap-3 bg-emerald-500 hover:bg-emerald-600" 
              disabled={status === 'running'}
              onClick={() => handleAction('running')}
            >
              <Play className="h-4 w-4" /> Запустить
            </Button>
            <Button 
              className="w-full justify-start gap-3" 
              variant="outline"
              disabled={status === 'stopped'}
              onClick={() => handleAction('restarting')}
            >
              <RotateCcw className={`h-4 w-4 ${status === 'restarting' ? 'animate-spin' : ''}`} /> Перезапустить
            </Button>
            <Button 
              className="w-full justify-start gap-3" 
              variant="destructive"
              disabled={status === 'stopped'}
              onClick={() => handleAction('stopped')}
            >
              <Square className="h-4 w-4" /> Остановить
            </Button>
            <div className="pt-4 mt-4 border-t space-y-3">
              <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground">
                <RefreshCw className="h-4 w-4" /> Перечитать конфиги
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground">
                <Settings2 className="h-4 w-4" /> Параметры AMI
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-2 border-none shadow-sm flex flex-col h-[600px]">
          <CardHeader className="flex flex-row items-center justify-between shrink-0">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Terminal className="h-5 w-5 text-primary" /> Консоль Asterisk (Full Log)
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setLogs([])}>
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm">Экспорт</Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full bg-slate-950 p-4 border-t">
              <div className="space-y-1 font-mono text-xs">
                {logs.map((log, i) => (
                  <div key={i} className={`
                    ${log.includes('WARNING') ? 'text-amber-400' : 
                      log.includes('NOTICE') ? 'text-blue-400' : 
                      log.includes('SYSTEM') ? 'text-emerald-400' : 'text-slate-300'}
                  `}>
                    {log}
                  </div>
                ))}
                {status === 'running' && (
                  <div className="flex items-center gap-2 text-emerald-400">
                    <span className="animate-pulse">_</span>
                    <span>Asterisk ready for commands...</span>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
