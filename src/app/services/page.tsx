
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
  Play,
  UserPlus,
  Volume2,
  Copy,
  Search
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useFirestore } from "@/firebase"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function ServicesPage() {
  const [logs, setLogs] = useState([
    "[BRIDGE] Ожидание запуска скрипта на сервере...",
    "[SYSTEM] Служба Asterisk.service активна.",
    "[SECURITY] Режим ФСТЭК: Включен.",
  ])
  const { toast } = useToast()

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: "Скопировано в буфер" })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-primary">Управление и Безопасность</h2>
          <p className="text-sm text-muted-foreground">Настройка доступа и синхронизация с сервером AltLinux</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-emerald-500 font-bold px-4 py-1">
            BRIDGE: ONLINE
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Alert className="bg-amber-50 border-amber-200">
            <Volume2 className="h-5 w-5 text-amber-600" />
            <AlertTitle className="font-bold text-amber-900">Установка русской озвучки в AltLinux</AlertTitle>
            <AlertDescription className="text-[11px] mt-2 space-y-3 text-amber-800">
              <p>Если пакет <i>asterisk-sounds-ru</i> не найден, попробуйте найти правильное название в вашем репозитории:</p>
              <div className="bg-slate-900 text-slate-100 p-3 rounded flex items-center justify-between font-mono">
                <span>apt-cache search asterisk-sounds</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400" onClick={() => copyToClipboard('apt-cache search asterisk-sounds')}>
                  <Search className="h-3 w-3" />
                </Button>
              </div>
              <p className="font-bold">Ручная установка (рекомендуется):</p>
              <p>Вы можете загрузить озвучку напрямую в папку системы:</p>
              <div className="bg-slate-900 text-slate-100 p-3 rounded text-[10px] font-mono whitespace-pre overflow-x-auto">
                cd /var/lib/asterisk/sounds/ru && \<br/>
                wget http://asterisk.ru/files/sounds-ru.tar.gz && \<br/>
                tar xvf sounds-ru.tar.gz
              </div>
            </AlertDescription>
          </Alert>

          <Alert className="bg-primary/5 border-primary/20">
            <UserPlus className="h-5 w-5 text-primary" />
            <AlertTitle className="font-bold">Создание администратора</AlertTitle>
            <AlertDescription className="text-xs mt-2 space-y-2">
              <p>Для создания нового пользователя панели управления выполните команду на сервере:</p>
              <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-[11px] mt-2 border shadow-inner flex items-center justify-between">
                <p className="text-emerald-400">npm run setup-admin user@miac.ru password</p>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400" onClick={() => copyToClipboard('npm run setup-admin user@miac.ru password')}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </AlertDescription>
          </Alert>

          <Card className="border-none shadow-xl flex flex-col h-[300px] overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between shrink-0 bg-slate-900 text-white py-3">
              <div className="flex items-center gap-3">
                <Terminal className="h-4 w-4 text-emerald-400" />
                <span className="font-mono text-xs uppercase tracking-widest font-bold">Системный лог Моста</span>
              </div>
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
                <ShieldAlert className="h-4 w-4 text-amber-500" /> ФСТЭК / Безопасность
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Локальный контур</p>
                <p className="text-xs">Все секреты SIP сохраняются в локальном файле <code>pjsip_miac_users.conf</code>.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Play className="h-4 w-4 text-primary" /> Быстрые команды
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full justify-start gap-3 bg-primary text-white" onClick={() => {
                toast({ title: "Синхронизация", description: "Команда перезагрузки отправлена через Мост" });
              }}>
                <RefreshCw className="h-4 w-4" /> Core Reload
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
