"use client"

import { useState } from "react"
import { Upload, FileCode, CheckCircle2, AlertTriangle, Users, Save, Loader2, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { saveExtension } from "@/lib/telephony-store"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default function ImportExtensionsPage() {
  const [rawConfig, setRawConfig] = useState("")
  const [parsedData, setParsedData] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const { toast } = useToast()

  const handleParse = () => {
    if (!rawConfig.trim()) return

    try {
      const blocks = rawConfig.split(/(?=\[)/g)
      const results: any[] = []

      blocks.forEach(block => {
        const lines = block.split('\n').map(l => l.trim()).filter(l => l)
        if (lines.length === 0) return

        const headerMatch = lines[0].match(/\[(\d+)\]/)
        if (!headerMatch) return

        const id = headerMatch[1]
        let secret = ""
        let name = id 

        lines.forEach(line => {
          if (line.toLowerCase().startsWith('secret=')) {
            secret = line.split('=')[1]
          }
          if (line.toLowerCase().startsWith('callerid=')) {
            const cidValue = line.split('=')[1]
            const nameMatch = cidValue.match(/^([^<]+)/)
            if (nameMatch) {
              name = nameMatch[1].trim().replace(/"/g, '')
            }
          }
        })

        if (id && secret) {
          results.push({
            id,
            name,
            secret,
            tech: "PJSIP",
            context: "from-internal"
          })
        }
      })

      if (results.length === 0) {
        toast({ title: "Внимание", description: "Не найдено подходящих данных для импорта", variant: "destructive" })
      } else {
        setParsedData(results)
        toast({ title: "Успех", description: `Распознано абонентов: ${results.length}` })
      }
    } catch (e) {
      toast({ title: "Ошибка парсинга", description: "Проверьте формат введенных данных", variant: "destructive" })
    }
  }

  const handleImport = async () => {
    setIsProcessing(true)
    let count = 0
    let skipped = 0
    try {
      for (const ext of parsedData) {
        if (ext.secret.length >= 8) {
          await saveExtension(ext)
          count++
        } else {
          skipped++
        }
      }
      
      if (skipped > 0) {
        toast({ 
          title: "Импорт завершен", 
          description: `Добавлено: ${count}. Пропущено (слабый пароль): ${skipped}`,
          variant: skipped > 0 ? "destructive" : "default"
        })
      } else {
        toast({ title: "Импорт завершен", description: `Добавлено абонентов: ${count}` })
      }
      
      setParsedData([])
      setRawConfig("")
    } catch (e) {
      toast({ title: "Ошибка импорта", description: "Некоторые данные не удалось сохранить", variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-primary">Импорт абонентов</h2>
          <p className="text-sm text-muted-foreground">Парсинг из существующих конфигурационных файлов Asterisk</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="shadow-lg border-none">
          <CardHeader className="bg-muted/30">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileCode className="h-4 w-4 text-primary" /> Исходный конфиг
            </CardTitle>
            <CardDescription className="text-xs">
              Вставьте содержимое .conf файла
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <Textarea 
              placeholder="[228]&#10;secret=...&#10;callerid=Имя <228>..." 
              className="min-h-[400px] font-mono text-[11px] bg-slate-50"
              value={rawConfig}
              onChange={(e) => setRawConfig(e.target.value)}
            />
            <Button className="w-full gap-2" onClick={handleParse}>
              <Upload className="h-4 w-4" /> Распознать данные
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {parsedData.length > 0 ? (
            <Card className="shadow-xl border-primary/20">
              <CardHeader className="bg-emerald-50 border-b border-emerald-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" /> Предпросмотр ({parsedData.length})
                  </CardTitle>
                  <Button size="sm" onClick={handleImport} disabled={isProcessing} className="bg-emerald-600 hover:bg-emerald-700">
                    {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 mr-2" />}
                    Импортировать
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Номер</TableHead>
                      <TableHead className="text-xs">Пароль</TableHead>
                      <TableHead className="text-xs">Статус</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((ext, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs font-bold text-primary">{ext.id}</TableCell>
                        <TableCell className="font-mono text-[10px] text-muted-foreground">{ext.secret}</TableCell>
                        <TableCell>
                          {ext.secret.length < 8 ? (
                            <Badge variant="destructive" className="text-[8px] uppercase">Слишком короткий</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[8px] uppercase bg-emerald-100 text-emerald-700">OK</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center bg-muted/20 rounded-xl border-2 border-dashed">
              <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-sm font-bold text-muted-foreground">Ожидание данных</h3>
              <p className="text-xs text-muted-foreground mt-2">
                Для импорта пароли должны быть не менее 8 знаков
              </p>
            </div>
          )}

          <Card className="bg-amber-50 border-amber-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-amber-700">
                <ShieldAlert className="h-4 w-4" /> Политика безопасности
              </CardTitle>
            </CardHeader>
            <CardContent className="text-[11px] text-amber-900 space-y-2 leading-relaxed">
              <p>В соответствии с требованиями ФСТЭК:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li className="font-bold">Абоненты с паролями менее 8 символов будут пропущены при импорте.</li>
                <li>Рекомендуется изменить слабые пароли в исходном конфиге перед загрузкой.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
