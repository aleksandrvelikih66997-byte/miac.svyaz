
"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, ArrowDownLeft, ArrowUpRight, Trash2, HelpCircle } from "lucide-react"
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
  const { toast } = useToast()

  const loadData = async () => {
    const [r, t, e, q, i] = await Promise.all([getRoutes(), getTrunks(), getExtensions(), getQueues(), getIvrs()])
    setRoutes(r || [])
    setTrunks(t || [])
    setExtensions(e || [])
    setQueues(q || [])
    setIvrs(i || [])
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
        <h2 className="text-2xl font-bold text-primary">Маршрутизация</h2>
        <Button onClick={() => setIsAddOpen(true)} className="gap-2 shadow-lg">
          <Plus className="h-4 w-4" /> Создать маршрут
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <div className="md:col-span-3 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-muted p-1 h-12">
              <TabsTrigger value="inbound" className="gap-2 px-6">
                <ArrowDownLeft className="h-4 w-4" /> Входящие (DID)
              </TabsTrigger>
              <TabsTrigger value="outbound" className="gap-2 px-6">
                <ArrowUpRight className="h-4 w-4" /> Исходящие (Транки)
              </TabsTrigger>
            </TabsList>

            <div className="mt-6 space-y-4">
              <TabsContent value="inbound" className="space-y-4 m-0">
                {routes.filter(r => r.type === 'inbound').map((route) => (
                  <Card key={route.id} className="border-none shadow-sm overflow-hidden group">
                    <CardContent className="flex items-center p-4 gap-6">
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">DID Номер</p>
                        <span className="font-mono font-bold text-lg text-primary">{route.pattern}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">НАПРАВИТЬ НА:</span>
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100">{route.destination}</Badge>
                      </div>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteRoute(route.id).then(loadData)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                {routes.filter(r => r.type === 'inbound').length === 0 && (
                   <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                     Нет входящих правил. Звонки из транков будут отклоняться.
                   </div>
                )}
              </TabsContent>

              <TabsContent value="outbound" className="space-y-4 m-0">
                {routes.filter(r => r.type === 'outbound').map((route) => (
                  <Card key={route.id} className="border-none shadow-sm group">
                    <CardContent className="flex items-center p-4 gap-6">
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Шаблон набора</p>
                        <span className="font-mono font-bold text-lg text-primary">{route.pattern}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">ЧЕРЕЗ ЛИНИЮ:</span>
                        <Badge className="bg-primary/5 text-primary border-primary/20">{route.destination}</Badge>
                      </div>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteRoute(route.id).then(loadData)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                {routes.filter(r => r.type === 'outbound').length === 0 && (
                   <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                     Нет исходящих правил. Звонки на внешние номера недоступны.
                   </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card className="bg-blue-50 border-blue-100 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-blue-700">
                <HelpCircle className="h-4 w-4" /> Справка по правилам
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-blue-800">
              <div>
                <p className="font-bold uppercase mb-1">Как это работает?</p>
                <p>Внутренние звонки (например, 101 {"->"} 102) работают автоматически. Здесь настраивается только связь с внешним миром.</p>
              </div>
              <div>
                <p className="font-bold mb-1">Входящие (DID)</p>
                <p>Укажите номер, который вам выдал провайдер (например, 74951234567), чтобы направить его на сотрудника.</p>
              </div>
              <div>
                <p className="font-bold mb-1">Исходящие (Шаблоны)</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li><code className="bg-white px-1">8X.</code> — для звонков по РФ</li>
                  <li><code className="bg-white px-1">.</code> — разрешить звонить на любые номера</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый {activeTab === 'inbound' ? 'входящий' : 'исходящий'} маршрут</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label className="text-xs font-bold uppercase">{activeTab === 'inbound' ? 'Внешний номер (DID)' : 'Шаблон (Pattern)'}</Label>
              <Input 
                value={newRoute.pattern} 
                onChange={e => setNewRoute({...newRoute, pattern: e.target.value})} 
                placeholder={activeTab === 'inbound' ? "74950000000" : "8X."} 
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-bold uppercase">Куда направить звонок</Label>
              <Select value={newRoute.destination} onValueChange={v => setNewRoute({...newRoute, destination: v})}>
                <SelectTrigger><SelectValue placeholder="Выберите цель..." /></SelectTrigger>
                <SelectContent>
                  {activeTab === 'inbound' ? (
                    <>
                      <SelectItem value="hdr-ext" disabled className="font-bold text-primary">Абоненты</SelectItem>
                      {extensions.map(e => <SelectItem key={e.id} value={`Extension:${e.id}`}>{e.id} - {e.name}</SelectItem>)}
                      <SelectItem value="hdr-q" disabled className="font-bold text-primary">Очереди</SelectItem>
                      {queues.map(q => <SelectItem key={q.id} value={`Queue:${q.name}`}>{q.name}</SelectItem>)}
                      <SelectItem value="hdr-ivr" disabled className="font-bold text-primary">Голосовое меню</SelectItem>
                      {ivrs.map(i => <SelectItem key={i.id} value={`IVR:${i.id}`}>{i.name}</SelectItem>)}
                    </>
                  ) : (
                    <>
                      <SelectItem value="hdr-tr" disabled className="font-bold text-primary">Внешние линии (Транки)</SelectItem>
                      {trunks.map(t => <SelectItem key={t.id} value={`Trunk:${t.id}`}>{t.name}</SelectItem>)}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Отмена</Button>
            <Button onClick={handleAdd}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
