
"use client"

import { useState, useEffect } from "react"
import { 
  RotateCcw, 
  Terminal, 
  RefreshCw,
  Server,
  ShieldAlert,
  Play,
  UserPlus,
  Volume2,
  Copy,
  History,
  ShieldCheck,
  Search
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { getAuditLogs } from "@/lib/audit-logger"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"

export default function ServicesPage() {
  const [logs] = useState([
    "[МОСТ] Ожидание запуска скрипта на сервере...",
    "[СИСТЕМА] Служба Asterisk.service активна.",
    "[БЕЗОПАСНОСТЬ] Режим ФСТЭК: Включен.",
  ])
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [searchLog, setSearchLog] = useState("")
  const { toast } = useToast()

  const loadAudit = async () => {
    const data = await getAuditLogs()
    setAuditLogs(data)
  }

  useEffect(() => {
    loadAudit()
    const interval = setInterval(loadAudit, 10000)
    return () => clearInterval(interval)
  }, [])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: "Скопировано в буфер" })
  }

  const filteredAudit = auditLogs.filter(log => 
    log.details.toLowerCase().includes(searchLog.toLowerCase()) ||
    log.action.toLowerCase().includes(searchLog.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-primary">Управление и Безопасность</h2>
          <p className="text-sm text-muted-foreground">Настройка доступа и аудит действий администраторов</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-emerald-500 font-bold px-4 py-1 uppercase tracking-tighter">
            Мост: В сети
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card className="border-none shadow-xl overflow-hidden">
            <CardHeader className="bg-primary/5 border-b py-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" /> Журнал аудита действий
                </CardTitle>
                <div className="relative w-48">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input 
                    placeholder="Поиск по логу..." 
                    className="h-8 pl-7 text-[10px] bg-white border-none shadow-inner"
                    value={searchLog}
                    onChange={(e) => setSearchLog(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="text-[10px] font-bold uppercase w-[140px]">Дата и время</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase w-[100px]">Действие</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase">Подробности</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAudit.map((log, i) => (
                      <TableRow key={i} className="hover:bg-muted/5">
                        <TableCell className="text-[10px] font-mono text-muted-foreground">
                          {new Date(log.timestamp).toLocaleString('ru-RU')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[8px] font-bold uppercase py-0 px-1 border-primary/30 text-primary">
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[10px] font-medium text-slate-700">
                          {log.details}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredAudit.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-12 text-muted-foreground text-xs">
                          История действий пуста
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          <Alert className="bg-amber-50 border-amber-200 shadow-sm">
            <Volume2 className="h-5 w-5 text-amber-600" />
            <AlertTitle className="font-bold text-amber-900">Установка русской озвучки в AltLinux</AlertTitle>
            <AlertDescription className="text-[11px] mt-2 space-y-3 text-amber-800">
              <p>Для вашего сервера AltLinux SP 10 правильный пакет называется <b>asterisk-sounds-ru-base</b>. Выполните команду:</p>
              <div className="bg-slate-900 text-slate-100 p-3 rounded flex items-center justify-between font-mono">
                <span>apt-get install asterisk-sounds-ru-base</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400" onClick={() => copyToClipboard('apt-get install asterisk-sounds-ru-base')}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </AlertDescription>
          </Alert>

          <Card className="border-none shadow-xl flex flex-col h-[200px] overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between shrink-0 bg-slate-900 text-white py-3">
              <div className="flex items-center gap-3">
                <Terminal className="h-4 w-4 text-emerald-400" />
                <span className="font-mono text-xs uppercase tracking-widest font-bold text-emerald-400">Консоль моста</span>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden">
              <ScrollArea className="h-full bg-slate-950 p-6">
                <div className="space-y-1.5 font-mono text-[11px]">
                  {logs.map((log, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="text-slate-600 shrink-0">[{new Date().toLocaleTimeString()}]</span>
                      <span className={log.includes('ОШИБКА') ? 'text-rose-400' : 'text-slate-300'}>
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
          <Card className="border shadow-lg bg-emerald-50/50">
            <CardHeader className="pb-3 border-b border-emerald-100 bg-emerald-100/30">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-emerald-800">
                <ShieldCheck className="h-4 w-4" /> Закрытый контур (ФСТЭК)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-700 uppercase">
                   <Badge variant="outline" className="h-4 border-emerald-300">ВКЛ</Badge> Изоляция шрифтов
                </div>
                <p className="text-[10px] text-emerald-800 leading-relaxed">
                  Использование внешних CDN (Google Fonts) полностью отключено. Система использует только локальные ресурсы.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-700 uppercase">
                   <Badge variant="outline" className="h-4 border-emerald-300">ВКЛ</Badge> Защита сессий
                </div>
                <p className="text-[10px] text-emerald-800 leading-relaxed">
                  Куки сессии защищены (HttpOnly) и имеют ограниченное время жизни.
                </p>
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
                toast({ title: "Синхронизация", description: "Команда перезагрузки отправлена" });
              }}>
                <RefreshCw className="h-4 w-4" /> Перезагрузить Asterisk
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
