"use client"

import { useState, useEffect, useRef } from "react"
import { Mic2, Plus, Trash2, Keyboard, Upload, Loader2, CheckCircle2, Music } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { getIvrs, saveIvr, deleteIvr, getExtensions, getQueues } from "@/lib/telephony-store"
import { uploadAudioAction } from "@/app/actions/audio-actions"

export default function IvrPage() {
  const [ivrs, setIvrs] = useState<any[]>([])
  const [extensions, setExtensions] = useState<any[]>([])
  const [queues, setQueues] = useState<any[]>([])
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [newIvr, setNewIvr] = useState({ name: "", announcementFile: "demo-congrats", digitMappings: [] as string[] })
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [tempDigit, setTempDigit] = useState("")
  const [tempType, setTempType] = useState("ext")
  const [tempTarget, setTempTarget] = useState("")

  const { toast } = useToast()

  const load = async () => {
    try {
      const [i, e, q] = await Promise.all([getIvrs(), getExtensions(), getQueues()])
      setIvrs(i || [])
      setExtensions(e || [])
      setQueues(q || [])
    } catch (error) {
      console.error("Failed to load IVR data", error)
    }
  }

  useEffect(() => { load() }, [])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.wav') && !file.name.endsWith('.mp3')) {
      toast({ title: "Ошибка", description: "Допускаются только .wav или .mp3", variant: "destructive" })
      return
    }

    setIsUploading(true)
    const formData = new FormData()
    formData.append('audio', file)

    try {
      const result = await uploadAudioAction(formData)
      if (result.success) {
        const nameWithoutExt = result.fileName.replace(/\.[^/.]+$/, "")
        setNewIvr({ ...newIvr, announcementFile: nameWithoutExt })
        toast({ title: "Файл загружен", description: `Имя в конфиге: ${nameWithoutExt}` })
      } else {
        throw new Error(result.error)
      }
    } catch (error: any) {
      toast({ title: "Ошибка загрузки", description: error.message, variant: "destructive" })
    } finally {
      setIsUploading(false)
    }
  }

  const handleSave = async () => {
    if (!newIvr.name) {
      toast({ title: "Ошибка", description: "Введите название меню", variant: "destructive" })
      return
    }
    await saveIvr(newIvr)
    setIsAddOpen(false)
    setNewIvr({ name: "", announcementFile: "demo-congrats", digitMappings: [] })
    setTempDigit("")
    setTempTarget("")
    load()
    toast({ title: "Голосовое меню сохранено" })
  }

  const addMapping = () => {
    if (!tempDigit || !tempTarget) {
      toast({ title: "Ошибка", description: "Заполните кнопку и ID", variant: "destructive" })
      return
    }
    const mapping = `${tempDigit}:${tempType}:${tempTarget}`
    setNewIvr({
      ...newIvr,
      digitMappings: [...newIvr.digitMappings, mapping]
    })
    setTempDigit("")
    setTempTarget("")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-primary">Голосовое меню (IVR)</h2>
          <p className="text-sm text-muted-foreground">Настройка приветствий и переходов по кнопкам</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="gap-2 shadow-lg">
          <Plus className="h-4 w-4" /> Добавить меню
        </Button>
      </div>

      <div className="grid gap-6">
        {ivrs.map(ivr => (
          <Card key={ivr.id} className="border-none shadow-lg group">
            <CardHeader className="bg-primary/5 border-b flex flex-row items-center justify-between py-4">
              <CardTitle className="text-lg flex items-center gap-3">
                <Mic2 className="h-5 w-5 text-primary" /> {ivr.name}
              </CardTitle>
              <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => deleteIvr(ivr.id).then(load)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="pt-4 grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Файл приветствия:</p>
                <div className="flex items-center gap-2">
                   <Music className="h-4 w-4 text-primary/40" />
                   <code className="bg-muted px-2 py-1 rounded text-xs font-mono border block w-fit">
                    {ivr.announcementFile}.wav
                  </code>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Назначения кнопок:</p>
                <div className="space-y-1">
                  {(ivr.digitMappings || []).map((m: string) => {
                    const [d, type, id] = m.split(':');
                    return (
                      <div key={m} className="flex items-center gap-2 text-xs bg-muted/30 p-2 rounded border border-transparent hover:border-muted-foreground/20 transition-colors">
                        <Keyboard className="h-3 w-3 text-primary" /> 
                        <span className="font-bold">Кнопка {d}:</span>
                        <span className="text-muted-foreground">
                          {type === 'ext' ? 'Абонент' : type === 'queue' ? 'Группа' : 'IVR'}
                        </span>
                        <span className="font-mono bg-white px-1 rounded border ml-auto">{id}</span>
                      </div>
                    )
                  })}
                  {(!ivr.digitMappings || ivr.digitMappings.length === 0) && (
                    <p className="text-xs text-muted-foreground italic">Кнопки не настроены</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Настройка IVR</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Название меню</Label>
              <Input value={newIvr.name} onChange={e => setNewIvr({...newIvr, name: e.target.value})} placeholder="Main Menu" />
            </div>
            
            <div className="grid gap-2">
              <Label>Приветствие (Audio)</Label>
              <div className="flex gap-2 items-center">
                <Input 
                  value={newIvr.announcementFile} 
                  onChange={e => setNewIvr({...newIvr, announcementFile: e.target.value})} 
                  placeholder="miac-welcome" 
                  className="flex-1"
                />
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  className="hidden" 
                  accept=".wav,.mp3"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon" 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">Загрузите файл для автоматической синхронизации</p>
            </div>
            
            <div className="p-4 border rounded-lg bg-muted/20 space-y-3">
              <p className="text-[10px] font-bold uppercase text-primary">Добавить переход</p>
              <div className="flex gap-2">
                <Input 
                  placeholder="Кнопка" 
                  className="w-20" 
                  value={tempDigit} 
                  onChange={e => setTempDigit(e.target.value)} 
                />
                <Select value={tempType} onValueChange={setTempType}>
                  <SelectTrigger className="w-[120px]"><SelectValue placeholder="Тип" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ext">Абонент</SelectItem>
                    <SelectItem value="queue">Группа</SelectItem>
                    <SelectItem value="ivr">Другой IVR</SelectItem>
                  </SelectContent>
                </Select>
                <Input 
                  placeholder="ID / Номер" 
                  value={tempTarget} 
                  onChange={e => setTempTarget(e.target.value)} 
                />
              </div>
              <Button variant="secondary" size="sm" className="w-full h-8" onClick={addMapping}>
                Добавить в список
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Отмена</Button>
            <Button onClick={handleSave} className="gap-2">
              <CheckCircle2 className="h-4 w-4" /> Сохранить меню
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}