
"use client"

import { useState } from "react"
import { Wand2, Send, Copy, CheckCircle2, AlertCircle, Terminal, Info } from "lucide-react"
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
        description: "Не удалось получить ответ от ИИ. Попробуйте позже.",
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
      description: "Конфигурация скопирована в буфер обмена",
    })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-headline font-bold text-primary">ИИ Помощник по конфигурации</h2>
        <p className="text-muted-foreground">Опишите задачу на естественном языке, и ИИ подготовит конфиг для Asterisk</p>
      </div>

      <Card className="border-primary/20 shadow-lg bg-card overflow-hidden">
        <CardHeader className="bg-primary/5 border-b">
          <CardTitle className="flex items-center gap-2 text-primary">
            <Wand2 className="h-5 w-5" /> Ваш запрос
          </CardTitle>
          <CardDescription>
            Например: "Создать входящий маршрут для номера 74951234567, который переводит звонок на IVR 'main-menu' в рабочее время и на голосовую почту 101 в нерабочее"
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <Textarea 
            placeholder="Опишите желаемую конфигурацию здесь..." 
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
              {isLoading ? (
                <>Обработка...</>
              ) : (
                <>
                  Сгенерировать <Send className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="space-y-2 animate-pulse">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Анализ параметров Asterisk...</span>
            <span>45%</span>
          </div>
          <Progress value={45} className="h-1" />
        </div>
      )}

      {result && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="shadow-sm border-none bg-emerald-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> Тип конфигурации
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="uppercase font-mono text-emerald-800 bg-emerald-100 px-2 py-1 rounded text-xs">
                  {result.configType}
                </span>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-none bg-blue-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-blue-700">
                  <Info className="h-4 w-4" /> Пояснение
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-blue-900 leading-relaxed">
                  {result.explanation}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-xl border-none overflow-hidden">
            <CardHeader className="bg-slate-900 text-slate-100 flex flex-row items-center justify-between py-3">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                <span className="text-xs font-mono">Asterisk Config Snippet</span>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 text-slate-100 hover:text-white hover:bg-slate-800 gap-1"
                onClick={() => copyToClipboard(result.generatedConfig)}
              >
                <Copy className="h-3 w-3" /> Копировать
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <pre className="p-6 bg-slate-950 text-emerald-400 font-mono text-sm overflow-x-auto">
                <code>{result.generatedConfig}</code>
              </pre>
            </CardContent>
          </Card>
          
          <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-lg border border-amber-100">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              <strong>Внимание:</strong> Сгенерированная конфигурация является рекомендательной. Перед применением на "боевом" сервере Asterisk 17 (AltLinux SP) обязательно проверьте синтаксис и соответствие вашей сетевой топологии.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
