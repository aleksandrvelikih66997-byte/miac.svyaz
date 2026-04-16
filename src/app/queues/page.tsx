
"use client"

import { useState, useEffect } from "react"
import { ListOrdered, Plus, Trash2, Users, Music } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { getQueues, saveQueue, deleteQueue, getExtensions } from "@/lib/telephony-store"

export default function QueuesPage() {
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [queues, setQueues] = useState<any[]>([])
  const [extensions, setExtensions] = useState<any[]>([])
  const [newQueue, setNewQueue] = useState({ 
    name: "", 
    strategy: "ringall", 
    members: [] as string[],
    musicOnHoldClass: "default"
  })
  const { toast } = useToast()

  const load = async () => {
    const [q, e] = await Promise.all([getQueues(), getExtensions()])
    setQueues(q)
    setExtensions(e)
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    if (!newQueue.name) return
    await saveQueue(newQueue)
    setIsAddOpen(false)
    setNewQueue({ name: "", strategy: "ringall", members: [], musicOnHoldClass: "default" })
    load()
    toast({ title: "Группа сохранена" })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-primary">Группы (Очереди)</h2>
          <p className="text-sm text-muted-foreground">Распределение входящих звонков между сотрудниками</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="gap-2 shadow-lg">
          <Plus className="h-4 w-4" /> Создать группу
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {queues.map(q => (
          <Card key={q.id} className="border-none shadow-xl overflow-hidden group hover:scale-[1.01] transition-transform">
            <CardHeader className="bg-muted/30 pb-4">
              <CardTitle className="text-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListOrdered className="h-5 w-5 text-primary" />
                  {q.name}
                </div>
                <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => deleteQueue(q.id).then(load)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-muted/50 p-2 rounded">
                  <p className="text-muted-foreground font-bold uppercase text-[9px]">Стратегия</p>
                  <p className="font-medium">{q.strategy}</p>
                </div>
                <div className="bg-primary/5 p-2 rounded">
                  <p className="text-primary/60 font-bold uppercase text-[9px]">Музыка (MOH)</p>
                  <p className="font-medium flex items-center gap-1">
                    <Music className="h-3 w-3" /> {q.musicOnHoldClass || 'default'}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2 flex items-center gap-1">
                  <Users className="h-3 w-3" /> Участники ({q.members?.length || 0})
                </p>
                <div className="flex flex-wrap gap-1">
                  {(q.members || []).map((m: string) => (
                    <span key={m} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-bold">{m}</span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {queues.length === 0 && (
          <div className="col-span-full py-12 text-center border-2 border-dashed rounded-xl text-muted-foreground">
            Нет активных групп. Нажмите "Создать группу".
          </div>
        )}
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Настройка группы вызова</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Название (ID для Asterisk)</Label>
              <Input value={newQueue.name} onChange={e => setNewQueue({...newQueue, name: e.target.value})} placeholder="registratura" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Стратегия</Label>
                <Select value={newQueue.strategy} onValueChange={v => setNewQueue({...newQueue, strategy: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ringall">Все сразу</SelectItem>
                    <SelectItem value="leastrecent">Наименее занятому</SelectItem>
                    <SelectItem value="random">Случайно</SelectItem>
                    <SelectItem value="rrordered">По очереди</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Музыка ожидания</Label>
                <Select value={newQueue.musicOnHoldClass} onValueChange={v => setNewQueue({...newQueue, musicOnHoldClass: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Стандартная</SelectItem>
                    <SelectItem value="classic">Классика</SelectItem>
                    <SelectItem value="jazz">Джаз</SelectItem>
                    <SelectItem value="none">Гудки</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Участники группы</Label>
              <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto border p-3 rounded bg-muted/20">
                {extensions.map(ext => (
                  <div key={ext.id} className="flex items-center gap-2">
                    <Checkbox 
                      id={`ext-${ext.id}`} 
                      checked={newQueue.members.includes(ext.id)}
                      onCheckedChange={(checked) => {
                        const members = checked 
                          ? [...newQueue.members, ext.id]
                          : newQueue.members.filter(m => m !== ext.id)
                        setNewQueue({...newQueue, members})
                      }}
                    />
                    <label htmlFor={`ext-${ext.id}`} className="text-xs cursor-pointer">{ext.id} ({ext.name})</label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Отмена</Button>
            <Button onClick={handleSave}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
