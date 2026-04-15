
"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, ArrowDownLeft, ArrowUpRight, GripVertical, Play, Settings2, Trash2 } from "lucide-react"

export default function RoutingPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-headline font-bold">Маршрутизация</h2>
          <p className="text-sm text-muted-foreground">Управление логикой обработки входящих и исходящих вызовов</p>
        </div>
      </div>

      <Tabs defaultValue="inbound" className="space-y-6">
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
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Новый маршрут
            </Button>
          </div>
          
          {[
            { id: 1, did: "74951234567", dest: "IVR: MainMenu", priority: 1, status: "Active" },
            { id: 2, did: "74959998877", dest: "Queue: Support", priority: 2, status: "Active" },
            { id: 3, did: "ANY", dest: "Ext: 100", priority: 10, status: "Disabled" },
          ].map((route) => (
            <Card key={route.id} className="border-none shadow-sm group">
              <CardContent className="flex items-center p-4 gap-6">
                <GripVertical className="h-5 w-5 text-muted-foreground/30 cursor-grab" />
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-primary">{route.did}</span>
                    <Badge variant={route.status === 'Active' ? 'secondary' : 'outline'} className="text-[10px]">
                      {route.status === 'Active' ? 'Активен' : 'Отключен'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Приоритет: {route.priority}</p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Направление:</span>
                  <span className="font-medium bg-accent/10 text-accent px-2 py-1 rounded">{route.dest}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8"><Settings2 className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="outbound" className="space-y-4">
           <div className="flex justify-end">
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Новый маршрут
            </Button>
          </div>

          {[
            { id: 1, name: "City-Calls", pattern: "8[2-9]XXXXXXXXX", trunk: "Beeline-Main", status: "Active" },
            { id: 2, name: "Emergency", pattern: "112|911", trunk: "Rostelecom-Backup", status: "Active" },
            { id: 3, name: "International", pattern: "00X.", trunk: "Zadarma", status: "Active" },
          ].map((route) => (
            <Card key={route.id} className="border-none shadow-sm group">
              <CardContent className="flex items-center p-4 gap-6">
                <GripVertical className="h-5 w-5 text-muted-foreground/30 cursor-grab" />
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-primary">{route.name}</span>
                    <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
                      {route.pattern}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Шаблон набора</p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Транк:</span>
                  <span className="font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 rounded">{route.trunk}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8"><Settings2 className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}
