
"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, ArrowDownLeft, ArrowUpRight, Trash2, HelpCircle, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { getRoutes, saveRoute, deleteRoute, getTrunks, getExtensions, getQueues, getIvrs } from "@/lib/telephony-store"

export default function RoutingPage() {
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("inbound")
  const [newRoute, setNewRoute] = useState({ pattern: "", destination: "", name: "" })
  const [routes, setRoutes] = useState<any[]>([])
  const [trunks, setTrunks] = useState<any[]>([])
  const [extensions, setExtensions] = useState<any[]>([])
  const [queues, setQueues] = useState<any[]>([])
  const [ivrs, setIvrs] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [r, t, e, q, i] = await Promise.all([getRoutes(), getTrunks(), getExtensions(), getQueues(), getIvrs()])
      setRoutes(r || [])
      setTrunks(t || [])
      setExtensions(e || [])
      setQueues(q || [])
      setIvrs(i || [])
    } catch (err) {
      console.error("Load Error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const handleAdd = async () => {
    if (!newRoute.pattern || !newRoute.destination) {
      toast({ title: "Ошибка", description: "Заполните шаблон и назначение", variant: "destructive" })
      return
    }
    await saveRoute({ ...newRoute, type: activeTab })
    setIsAddOpen(false)
    setNewRoute({ pattern: "", destination: "", name: "" })
    toast({ title: "Маршрут сохранен" })
    loadData()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-primary">Маршрутизация</h2>
          <p className="text-sm text-muted-foreground">Управление входящими и исходящими потоками звонков</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="gap-2 shadow-lg bg-primary">
          <Plus className="h-4 w-4" /> Создать маршрут
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <div className="md:col-span-3 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-muted p-1 h-12">
              <TabsTrigger value="inbound" className="gap-2 px-6 data-[state=active]:bg-white data-[state=active]:text-primary">
                <ArrowDownLeft className="h-4 w-4" /> Входящие (DID)
              </TabsTrigger>
              <TabsTrigger value="outbound" className="gap-2 px-6 data-[state=active]:bg-white data-[state=active]:text-primary">
                <ArrowUpRight className="h-4 w-4" /> Исходящие (Транки)
              </TabsTrigger>
            </TabsList>

            <div className="mt-6 space-y-4">
              {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" /></div>
              ) : (
                <>
                  <TabsContent value="inbound" className="space-y-4 m-0">
                    {routes.filter(r => r.type === 'inbound').map((route) => (
                      <Card key={route.id} className="border-none shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
                        <CardContent className="flex items-center p-4 gap-6">
                          <div className="flex-1">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">DID Номер / Шаблон</p>
                            <span className="font-mono font-bold text-lg text-primary">{route.pattern === '*' ? 'Все номера (*)' : route.pattern}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground uppercase">Направление:</span>
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 px-3">{route.destination}</Badge>
                          </div>
                          <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => deleteRoute(route.id).then(loadData)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                    {routes.filter(r => r.type === 'inbound').length === 0 && (
                      <p className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">Входящие маршруты не настроены</p>
                    )}
                  </TabsContent>

                  <TabsContent value="outbound" className="space-y-4 m-0">
                    {routes.filter(r => r.type === 'outbound').map((route) => (
                      <Card key={route.id} className="border-none shadow-sm hover:shadow-md transition-shadow">
                        <CardContent className="flex items-center p-4 gap-6">
                          <div className="flex-1">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Шаблон набора</p>
                            <span className="font-mono font-bold text-lg text-primary">{route.pattern}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground uppercase">Линия:</span>
                            <Badge className="bg-primary/5 text-primary border-primary/20 px-3">{route.destination}</Badge>
                          </div>
                          <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => deleteRoute(route.id).then(loadData)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                    {routes.filter(r => r.type === 'outbound').length === 0 && (
                      <p className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">Исходящие маршруты не настроены</p>
                    )}
                  </TabsContent>
                </>
              )}
            </div>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card className="bg-blue-50 border-blue-100 shadow-sm rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-blue-700 uppercase tracking-tighter">
                <HelpCircle className="h-4 w-4" /> Справка
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-blue-800 leading-relaxed">
              <div>
                <p className="font-bold uppercase mb-1">Входящие:</p>
                <p>Используйте номер провайдера или символ <strong>*</strong> для приема всех входящих звонков на IVR или группу.</p>
              </div>
              <div>
                <p className="font-bold uppercase mb-1">Исходящие:</p>
                <p>Шаблон <strong>8X.</strong> позволит звонить на все номера, начинающиеся с восьмерки.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Добавление маршрута ({activeTab === 'inbound' ? 'Вход' : 'Выход'})</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid gap-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {activeTab === 'inbound' ? 'DID Номер (или * для всех)' : 'Шаблон набора (например 8X.)'}
              </Label>
              <Input 
                value={newRoute.pattern} 
                onChange={e => setNewRoute({...newRoute, pattern: e.target.value})} 
                placeholder={activeTab === 'inbound' ? "74950000000" : "8X."} 
                className="bg-slate-50 border-none"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Назначение звонка</Label>
              <Select value={newRoute.destination} onValueChange={v => setNewRoute({...newRoute, destination: v})}>
                <SelectTrigger className="bg-slate-50 border-none">
                  <SelectValue placeholder="Выберите цель..." />
                </SelectTrigger>
                <SelectContent>
                  {activeTab === 'inbound' ? (
                    <>
                      <SelectItem value="hdr-ivr" disabled className="font-bold text-primary mt-2">Голосовые меню</SelectItem>
                      {ivrs.map(i => <SelectItem key={i.id} value={`IVR:${i.id}`}>{i.name}</SelectItem>)}
                      <SelectItem value="hdr-q" disabled className="font-bold text-primary mt-2">Очереди</SelectItem>
                      {queues.map(q => <SelectItem key={q.id} value={`Queue:${q.name}`}>{q.name}</SelectItem>)}
                      <SelectItem value="hdr-ext" disabled className="font-bold text-primary mt-2">Абоненты</SelectItem>
                      {extensions.map(e => <SelectItem key={e.id} value={`Extension:${e.id}`}>{e.id} - {e.name}</SelectItem>)}
                    </>
                  ) : (
                    <>
                      <SelectItem value="hdr-tr" disabled className="font-bold text-primary mt-2">Транки (Линии)</SelectItem>
                      {trunks.map(t => <SelectItem key={t.id} value={`Trunk:${t.id}`}>{t.name}</SelectItem>)}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="bg-slate-50 p-4 -mx-6 -mb-6 mt-4">
            <Button variant="ghost" onClick={() => setIsAddOpen(false)}>Отмена</Button>
            <Button onClick={handleAdd} className="bg-primary hover:bg-primary/90 px-8">Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
