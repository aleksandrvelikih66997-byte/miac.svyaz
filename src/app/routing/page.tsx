
"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, ArrowDownLeft, ArrowUpRight, GripVertical, Trash2, Loader2, PhoneForwarded, Globe } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { getRoutes, saveRoute, deleteRoute, getTrunks, getExtensions } from "@/lib/telephony-store"

export default function RoutingPage() {
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("inbound")
  const [newRoute, setNewRoute] = useState({ pattern: "", destination: "", priority: 1, name: "" })
  const [routes, setRoutes] = useState<any[]>([])
  const [trunks, setTrunks] = useState<any[]>([])
  const [extensions, setExtensions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  const { toast } = useToast()

  const loadData = async () => {
    setLoading(true)
    const [r, t, e] = await Promise.all([getRoutes(), getTrunks(), getExtensions()])
    setRoutes(r)
    setTrunks(t)
    setExtensions(e)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleAdd = async () => {
    if (!newRoute.pattern || !newRoute.destination) {
      toast({ title: "Ошибка", description: "Заполните все поля", variant: "destructive" })
      return
    }

    await saveRoute({
      ...newRoute,
      type: activeTab,
      status: "Active"
    })
    
    setIsAddOpen(false)
    setNewRoute({ pattern: "", destination: "", priority: 1, name: "" })
    toast({ title: "Маршрут успешно добавлен" })
    loadData()
  }

  const handleDelete = async (id: string) => {
    await deleteRoute(id)
    toast({ title: "Маршрут удален" })
    loadData()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-headline font-bold text-primary">Маршрутизация</h2>
          <p className="text-sm text-muted-foreground">Логика обработки вызовов (FreePBX Style)</p>
        </div>
        <Button className="gap-2 shadow-lg" onClick={() => setIsAddOpen(true)}>
          <Plus className="h-4 w-4" /> Создать маршрут
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-card border p-1 h-12 shadow-sm">
          <TabsTrigger value="inbound" className="gap-2 px-8 h-10 data-[state=active]:bg-primary data-[state=active]:text-white">
            <ArrowDownLeft className="h-4 w-4" /> Входящие (DID)
          </TabsTrigger>
          <TabsTrigger value="outbound" className="gap-2 px-8 h-10 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <ArrowUpRight className="h-4 w-4" /> Исходящие (Patterns)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbound" className="space-y-4">
          <Card className="bg-blue-50/50 border-blue-100 shadow-none mb-6">
            <CardContent className="p-4 flex items-center gap-4 text-sm text-blue-800">
              <PhoneForwarded className="h-5 w-5 shrink-0" />
              <p>Определите, на какой внутренний номер направить звонок при поступлении на конкретный <strong>DID номер</strong> (номер из транка).</p>
            </CardContent>
          </Card>
          
          {loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
            routes.filter(r => r.type === 'inbound').map((route) => (
              <Card key={route.id} className="border-none shadow-sm hover:shadow-md transition-shadow group">
                <CardContent className="flex items-center p-4 gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-muted-foreground uppercase">DID:</span>
                      <span className="font-mono font-black text-primary text-lg">{route.pattern}</span>
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">ACTIVE</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">НАЗНАЧЕНИЕ:</span>
                    <Badge variant="outline" className="text-sm px-4 py-1 border-primary/20 bg-primary/5">
                      {route.destination}
                    </Badge>
                  </div>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDelete(route.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="outbound" className="space-y-4">
          <Card className="bg-emerald-50/50 border-emerald-100 shadow-none mb-6">
            <CardContent className="p-4 flex items-center gap-4 text-sm text-emerald-800">
              <Globe className="h-5 w-5 shrink-0" />
              <p>Правила набора номера для выхода во внешний мир. Шаблон <strong>8X.</strong> означает любой номер, начинающийся на 8.</p>
            </CardContent>
          </Card>
          
          {loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
            routes.filter(r => r.type === 'outbound').map((route) => (
              <Card key={route.id} className="border-none shadow-sm group hover:border-emerald-200 border">
                <CardContent className="flex items-center p-4 gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-muted-foreground uppercase">PATTERN:</span>
                      <span className="font-mono font-black text-emerald-700 text-lg">{route.pattern}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">ЧЕРЕЗ ТРАНК:</span>
                    <Badge variant="outline" className="text-sm px-4 py-1 border-emerald-600/20 bg-emerald-50 text-emerald-800">
                      {route.destination}
                    </Badge>
                  </div>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDelete(route.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Новый {activeTab === 'inbound' ? 'входящий' : 'исходящий'} маршрут</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid gap-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {activeTab === 'inbound' ? 'Входящий номер (DID)' : 'Шаблон набора (Pattern)'}
              </Label>
              <Input 
                value={newRoute.pattern} 
                onChange={e => setNewRoute({...newRoute, pattern: e.target.value})} 
                placeholder={activeTab === 'inbound' ? "74951234567" : "8X."} 
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {activeTab === 'inbound' ? 'Куда направить звонок' : 'Использовать транк'}
              </Label>
              <Select value={newRoute.destination} onValueChange={v => setNewRoute({...newRoute, destination: v})}>
                <SelectTrigger><SelectValue placeholder="Выберите назначение..." /></SelectTrigger>
                <SelectContent>
                  {activeTab === 'inbound' ? (
                    extensions.map(e => <SelectItem key={e.id} value={`Ext: ${e.id}`}>{e.id} - {e.name}</SelectItem>)
                  ) : (
                    trunks.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Отмена</Button>
            <Button onClick={handleAdd} className={activeTab === 'outbound' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}>
              Сохранить маршрут
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
