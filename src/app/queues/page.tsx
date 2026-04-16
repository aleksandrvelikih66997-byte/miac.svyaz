
"use client"

import { useState, useEffect } from "react"
import { ListOrdered, Plus, Trash2, Users } from "lucide-react"
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
  const [newQueue, setNewQueue] = useState({ name: "", strategy: "ringall", members: [] as string[] })
  const { toast } = useToast()

  const load = async () => {
    const [q, e] = await Promise.all([getQueues(), getExtensions()])
    setQueues(q)
    setExtensions(e)
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    await saveQueue(newQueue)
    setIsAddOpen(false)
    setNewQueue({ name: "", strategy: "ringall", members: [] })
    load()
    toast({ title: "Группа сохранена" })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-primary">Группы (Очереди)</h2>
        <Button onClick={() => setIsAddOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Создать группу
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {queues.map(q => (
          <Card key={q.id} className="border-none shadow-xl overflow-hidden group">
            <CardHeader className="bg-muted/30">
              <CardTitle className="text-lg flex items-center justify-between">
                {q.name}
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteQueue(q.id).then(load)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardTitle>
              <p className="text-xs text-muted-foreground uppercase font-bold">Стратегия: {q.strategy}</p>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Участники ({q.members?.length || 0}):</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {(q.members || []).map((m: string) => (
                  <span key={m} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-bold">{m}</span>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Параметры группы</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Название группы (латиницей)</Label>
              <Input value={newQueue.name} onChange={e => setNewQueue({...newQueue, name: e.target.value})} placeholder="registratura" />
            </div>
            <div className="grid gap-2">
              <Label>Стратегия обзвона</Label>
              <Select value={newQueue.strategy} onValueChange={v => setNewQueue({...newQueue, strategy: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ringall">Звонят все сразу</SelectItem>
                  <SelectItem value="leastrecent">Наименее занятому</SelectItem>
                  <SelectItem value="random">Случайно</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Участники</Label>
              <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto border p-3 rounded">
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
                    <label htmlFor={`ext-${ext.id}`} className="text-sm">{ext.id} ({ext.name})</label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={handleSave}>Создать</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
