"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, ArrowDownLeft, ArrowUpRight, Trash2, PhoneForwarded, Globe, Info } from "lucide-react"
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
    try {
      const [r, t, e, q, i] = await Promise.all([getRoutes(), getTrunks(), getExtensions(), getQueues(), getIvrs()])
      setRoutes(r || [])
      setTrunks(t || [])
      setExtensions(e || [])
      setQueues(q || [])
      setIvrs(i || [])
    } catch (err) {
      console.error("Failed to load routing data", err)
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

  const handleDelete = async (id: string) => {
    await deleteRoute(id)
    toast({ title: "Удалено", description: "Маршрут удален" })
    loadData()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-primary">Маршрутизация</h2>
        <Button onClick={() => setIsAddOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Создать маршрут
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted p-1 h-12">
          <TabsTrigger value="inbound" className="gap-2 px-6">
            <ArrowDownLeft className="h-4 w-4" /> Входящие (DID)
          </TabsTrigger>
          <TabsTrigger value="outbound" className="gap-2 px-6">
            <ArrowUpRight className="h-4 w-4" /> Исходящие (Транки)
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <Card className="bg-blue-50/50 border-blue-100 mb-6">
            <CardContent className="p-4 flex gap-4 text-xs text-blue-800">
              <div className="shrink-0"><Info className="h-5 w-5" /></div>
              <div>
                <p className="font-bold uppercase mb-1">Как это работает?</p>
                <p>Внутренние звонки (100 {"->"} 123) работают автоматически. Здесь настраивается только связь с внешним миром.</p>
              </div>
            </CardContent>
          </Card>

          <TabsContent value="inbound" className="space-y-4">
            {routes.filter(r => r.type === 'inbound').map((route) => (
              <Card key={route.id} className="border-none shadow-sm group">
                <CardContent className="flex items-center p-4 gap-6">
                  <div className="flex-1">
                    <span className="text-xs font-bold text-muted-foreground mr-2">DID:</span>
                    <span className="font-mono font-bold text-lg">{route.pattern}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">НАПРАВИТЬ НА:</span>
                    <Badge variant="outline" className="bg-primary/5">{route.destination}</Badge>
                  </div>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(route.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
            {routes.filter(r => r.type === 'inbound').length === 0 && (
               <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                 Нет настроенных входящих маршрутов
               </div>
            )}
          </TabsContent>

          <TabsContent value="outbound" className="space-y-4">
            {routes.filter(r => r.type === 'outbound').map((route) => (
              <Card key={route.id} className="border-none shadow-sm group">
                <CardContent className="flex items-center p-4 gap-6">
                  <div className="flex-1">
                    <span className="text-xs font-bold text-muted-foreground mr-2">ШАБЛОН:</span>
                    <span className="font-mono font-bold text-lg">{route.pattern}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">ЧЕРЕЗ ТРАНК:</span>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700">{route.destination}</Badge>
                  </div>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(route.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
            {routes.filter(r => r.type === 'outbound').length === 0 && (
               <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                 Нет настроенных исходящих маршрутов
               </div>
            )}
          </TabsContent>
        </div>
      </Tabs>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый {activeTab === 'inbound' ? 'входящий' : 'исходящий'} маршрут</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>{activeTab === 'inbound' ? 'Внешний DID (например 7495...)' : 'Шаблон набора (например 8X.)'}</Label>
              <Input value={newRoute.pattern} onChange={e => setNewRoute({...newRoute, pattern: e.target.value})} placeholder={activeTab === 'inbound' ? "DID" : "8X."} />
            </div>
            <div className="grid gap-2">
              <Label>Назначение (Куда направить звонок)</Label>
              <Select value={newRoute.destination} onValueChange={v => setNewRoute({...newRoute, destination: v})}>
                <SelectTrigger><SelectValue placeholder="Выберите цель..." /></SelectTrigger>
                <SelectContent>
                  {activeTab === 'inbound' ? (
                    <>
                      <SelectItem value="header-ext" disabled className="font-bold text-primary">Абоненты</SelectItem>
                      {extensions.map(e => <SelectItem key={e.id} value={`Extension:${e.id}`}>{e.id} - {e.name}</SelectItem>)}
                      <SelectItem value="header-q" disabled className="font-bold text-primary">Группы (Очереди)</SelectItem>
                      {queues.map(q => <SelectItem key={q.id} value={`Queue:${q.name}`}>{q.name}</SelectItem>)}
                      <SelectItem value="header-ivr" disabled className="font-bold text-primary">Голосовое меню (IVR)</SelectItem>
                      {ivrs.map(i => <SelectItem key={i.id} value={`IVR:${i.id}`}>Меню: {i.name}</SelectItem>)}
                    </>
                  ) : (
                    <>
                      <SelectItem value="header-trunks" disabled className="font-bold text-primary">Внешние линии (Транки)</SelectItem>
                      {trunks.map(t => <SelectItem key={t.id} value={`Trunk:${t.id}`}>{t.name}</SelectItem>)}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Отмена</Button>
            <Button onClick={handleAdd}>Создать маршрут</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
