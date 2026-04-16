
"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, ArrowDownLeft, ArrowUpRight, GripVertical, Settings2, Trash2, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useFirestore, useCollection } from "@/firebase"
import { collection, doc, addDoc, deleteDoc, query, where } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"

export default function RoutingPage() {
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("inbound")
  const [newRoute, setNewRoute] = useState({ pattern: "", destination: "", priority: 1 })
  
  const db = useFirestore()
  const { toast } = useToast()
  
  const inboundQuery = query(collection(db, "routes"), where("type", "==", "inbound"))
  const outboundQuery = query(collection(db, "routes"), where("type", "==", "outbound"))
  
  const { data: inboundRoutes, loading: inLoading } = useCollection(inboundQuery)
  const { data: outboundRoutes, loading: outLoading } = useCollection(outboundQuery)

  const handleAdd = async () => {
    try {
      await addDoc(collection(db, "routes"), {
        ...newRoute,
        type: activeTab,
        status: "Active"
      })
      setIsAddOpen(false)
      setNewRoute({ pattern: "", destination: "", priority: 1 })
      toast({ title: "Маршрут создан" })
    } catch (e) {
      toast({ title: "Ошибка", variant: "destructive" })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "routes", id))
      toast({ title: "Маршрут удален" })
    } catch (e) {
      toast({ title: "Ошибка", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-headline font-bold">Маршрутизация</h2>
          <p className="text-sm text-muted-foreground">Управление логикой обработки входящих и исходящих вызовов</p>
        </div>
      </div>

      <Tabs defaultValue="inbound" className="space-y-6" onValueChange={setActiveTab}>
        <TabsList className="bg-card shadow-sm border p-1 h-11">
          <TabsTrigger value="inbound" className="gap-2 px-6">
            <ArrowDownLeft className="h-4 w-4" /> Входящие
          </TabsTrigger>
          <TabsTrigger value="outbound" className="gap-2 px-6">
            <ArrowUpRight className="h-4 w-4" /> Исходящие
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbound" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" className="gap-2" onClick={() => setIsAddOpen(true)}>
              <Plus className="h-4 w-4" /> Новый маршрут
            </Button>
          </div>
          
          {inLoading ? <Loader2 className="mx-auto animate-spin" /> : (
            inboundRoutes?.map((route) => (
              <Card key={route.id} className="border-none shadow-sm group">
                <CardContent className="flex items-center p-4 gap-6">
                  <GripVertical className="h-5 w-5 text-muted-foreground/30 cursor-grab" />
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-primary">{route.pattern}</span>
                      <Badge variant="secondary" className="text-[10px]">Активен</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Назначение:</span>
                    <span className="font-medium bg-accent/10 text-accent px-2 py-1 rounded">{route.destination}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(route.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="outbound" className="space-y-4">
           <div className="flex justify-end">
            <Button size="sm" className="gap-2" onClick={() => setIsAddOpen(true)}>
              <Plus className="h-4 w-4" /> Новый маршрут
            </Button>
          </div>
          
          {outLoading ? <Loader2 className="mx-auto animate-spin" /> : (
            outboundRoutes?.map((route) => (
              <Card key={route.id} className="border-none shadow-sm group">
                <CardContent className="flex items-center p-4 gap-6">
                  <GripVertical className="h-5 w-5 text-muted-foreground/30 cursor-grab" />
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-primary">{route.pattern}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Транк:</span>
                    <span className="font-medium bg-emerald-50 text-emerald-700 px-2 py-1 rounded">{route.destination}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(route.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый {activeTab === 'inbound' ? 'входящий' : 'исходящий'} маршрут</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>{activeTab === 'inbound' ? 'DID Номер' : 'Шаблон набора'}</Label>
              <Input value={newRoute.pattern} onChange={e => setNewRoute({...newRoute, pattern: e.target.value})} placeholder={activeTab === 'inbound' ? "7495..." : "8X."} />
            </div>
            <div className="grid gap-2">
              <Label>{activeTab === 'inbound' ? 'Куда направить' : 'Через какой транк'}</Label>
              <Input value={newRoute.destination} onChange={e => setNewRoute({...newRoute, destination: e.target.value})} placeholder={activeTab === 'inbound' ? "Ext: 101" : "Beeline"} />
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
