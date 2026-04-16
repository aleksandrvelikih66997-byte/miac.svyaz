
"use client"

import { useState, useEffect } from "react"
import { Mic2, Plus, Trash2, Keyboard, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { getIvrs, saveIvr, deleteIvr, getExtensions, getQueues } from "@/lib/telephony-store"

export default function IvrPage() {
  const [ivrs, setIvrs] = useState<any[]>([])
  const [extensions, setExtensions] = useState<any[]>([])
  const [queues, setQueues] = useState<any[]>([])
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [newIvr, setNewIvr] = useState({ name: "", announcementFile: "demo-congrats", digitMappings: [] as string[] })
  const { toast } = useToast()

  const load = async () => {
    const [i, e, q] = await Promise.all([getIvrs(), getExtensions(), getQueues()])
    setIvrs(i); setExtensions(e); setQueues(q);
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    await saveIvr(newIvr)
    setIsAddOpen(false)
    setNewIvr({ name: "", announcementFile: "demo-congrats", digitMappings: [] })
    load()
    toast({ title: "Голосовое меню сохранено" })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-primary">Голосовое меню (IVR)</h2>
        <Button onClick={() => setIsAddOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Добавить меню
        </Button>
      </div>

      <div className="grid gap-6">
        {ivrs.map(ivr => (
          <Card key={ivr.id} className="border-none shadow-lg">
            <CardHeader className="bg-primary/5 border-b flex flex-row items-center justify-between py-4">
              <CardTitle className="text-lg flex items-center gap-3">
                <Mic2 className="h-5 w-5 text-primary" /> {ivr.name}
              </CardTitle>
              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteIvr(ivr.id).then(load)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="pt-4 grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase">Файл приветствия:</p>
                <code className="bg-muted px-2 py-1 rounded text-sm">{ivr.announcementFile}.wav</code>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Назначения кнопок:</p>
                <div className="space-y-1">
                  {(ivr.digitMappings || []).map((m: string) => {
                    const [d, type, id] = m.split(':');
                    return (
                      <div key={m} className="flex items-center gap-2 text-sm bg-muted/30 p-2 rounded">
                        <Keyboard className="h-3 w-3" /> <span className="font-bold">Кнопка {d}:</span>
                        <span>{type === 'ext' ? `Абонент ${id}` : `Группа ${id}`}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Настройка IVR</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Название меню</Label>
              <Input value={newIvr.name} onChange={e => setNewIvr({...newIvr, name: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <Label>Имя файла (без .wav)</Label>
              <Input value={newIvr.announcementFile} onChange={e => setNewIvr({...newIvr, announcementFile: e.target.value})} />
            </div>
            <div className="p-4 border rounded bg-muted/20">
              <p className="text-xs font-bold mb-3">ДОБАВИТЬ ПЕРЕХОД (Нажмите 1, чтобы...)</p>
              <div className="flex gap-2">
                <Input placeholder="Кнопка" id="ivr-digit" className="w-20" />
                <Select id="ivr-type">
                  <SelectTrigger><SelectValue placeholder="Тип" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ext">Абонент</SelectItem>
                    <SelectItem value="queue">Группа</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="ID (например 100)" id="ivr-id" />
                <Button variant="secondary" onClick={() => {
                  const digit = (document.getElementById('ivr-digit') as HTMLInputElement).value;
                  const type = (document.getElementById('ivr-type') as HTMLSelectElement).getAttribute('data-value') || 'ext';
                  const target = (document.getElementById('ivr-id') as HTMLInputElement).value;
                  if (digit && target) {
                    setNewIvr({...newIvr, digitMappings: [...newIvr.digitMappings, `${digit}:${type}:${target}`]})
                  }
                }}>OK</Button>
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={handleSave}>Сохранить меню</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
