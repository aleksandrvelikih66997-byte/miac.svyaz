"use client"

import { useState } from "react"
import { Wand2, Send, Copy, CheckCircle2, AlertCircle, Terminal, Info, FileCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { intelligentConfigurationAssistant, type IntelligentConfigurationAssistantOutput } from "@/ai/flows/intelligent-configuration-assistant-flow"
import { useToast } from "@/hooks/use-toast"
import { Progress } from "@/components/ui/progress"

export default function AIAssistantPage() {
  const [request, setRequest] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<IntelligentConfigurationAssistantOutput | null>(null)
  const { toast } = useToast()

  const handleGenerate = async () => {
    if (!request.trim()) return
    
    setIsLoading(true)
    setResult(null)
    
    try {
      const output = await intelligentConfigurationAssistant({ request })
      setResult(output)
    } catch (error) {
      toast({
        title: "Ошибка генерации",
        description: "Не удалось получить ответ от ИИ. Проверьте подключение.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Скопировано",
      description: "Код скопирован в буфер обмена",
    })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-headline font-bold text-primary">ИИ Помощник по конфигурации</h2>
        <p className="text-muted-foreground">Оптимизировано для Asterisk 20 (AltLinux SP) с поддержкой PJSIP и AMI</p>
      </div>

      <Card className="border-primary/20 shadow-lg bg-card overflow-hidden">
        <CardHeader className="bg-primary/5 border-b">
          <CardTitle className="flex items-center gap-2 text-primary">
            <Wand2 className="h-5 w-5" /> Умный запрос
          </CardTitle>
          <CardDescription>
            Например: "Добавь SIP-транк Ростелеком через регистрацию" или "Создай диалплан для перевода звонка на номер 100 если занято"
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <Textarea 
            placeholder="Опишите задачу здесь..." 
            className="min-h-[120px] resize-none focus-visible:ring-accent"
            value={request}
            onChange={(e) => setRequest(e.target.value)}
          />
          <div className="flex justify-end">
            <Button 
              onClick={handleGenerate} 
              disabled={isLoading || !request.trim()}
              className="gap-2 bg-primary hover:bg-primary/90 min-w-[160px]"
            >
              {isLoading ? "Обработка..." : <>Сгенерировать <Send className="h-4 w-4" /></>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Использование контекста pjsip_miac_users.conf...</span>
            <span>Анализ...</span>
          </div>
          <Progress value={65} className="h-1" />
        </div>
      )}

      {result && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="shadow-sm border-none bg-emerald-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-emerald-700">
                  <FileCode className="h-4 w-4" /> Файл назначения
                </CardTitle>
              </CardHeader>
              <CardContent>
                <code className="text-xs font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-1 rounded">
                  {result.targetFile}
                </code>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-none bg-blue-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-blue-700">
                  <Info className="h-4 w-4" /> Логика работы
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-blue-900 leading-relaxed">
                  {result.explanation}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-xl border-none overflow-hidden">
            <CardHeader className="bg-slate-900 text-slate-100 flex flex-row items-center justify-between py-3 px-6">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                <span className="text-[10px] font-mono tracking-widest uppercase">Asterisk Snippet</span>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 text-slate-100 hover:text-white hover:bg-slate-800 gap-1 text-xs"
                onClick={() => copyToClipboard(result.generatedConfig)}
              >
                <Copy className="h-3 w-3" /> Копировать
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <pre className="p-6 bg-slate-950 text-emerald-400 font-mono text-xs overflow-x-auto border-t border-slate-800">
                <code>{result.generatedConfig}</code>
              </pre>
            </CardContent>
          </Card>
          
          <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-lg border border-amber-100 shadow-sm">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-amber-900 uppercase">Безопасность AMI/PJSIP</p>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Конфиг сгенерирован с учетом вашего AMI пользователя <strong>miac</strong>. Перед применением в <code>/etc/asterisk/</code> проверьте права доступа к файлам и выполните <code>asterisk -rx "core reload"</code>.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
