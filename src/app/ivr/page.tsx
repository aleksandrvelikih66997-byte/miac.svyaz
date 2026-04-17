
"use client"

import { useState, useEffect, useRef } from "react"
import { Mic2, Plus, Trash2, Upload, Loader2, CheckCircle2, Music, Clock, Settings2 } from "lucide-react"
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
import { Badge } from "@/components/ui/badge"

export default function IvrPage() {
  const [ivrs, setIvrs] = useState<any[]>([])
  const [extensions, setExtensions] = useState<any[]>([])
  const [queues, setQueues] = useState<any[]>([])
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  
  const [newIvr, setNewIvr] = useState({ 
    id: "",
    name: "", 
    announcementFile: "", 
    digitMappings: [] as string[],
    timeoutDestination: "" 
  })
  
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

    setIsUploading(true)
    const formData = new FormData()
    formData.append('audio', file)

    try {
      const result = await uploadAudioAction(formData)
      if (result.success) {
        const nameWithoutExt = result.fileName.replace(/\.[^/.]+$/, "")
        setNewIvr(prev => ({ ...prev, announcementFile: nameWithoutExt }))
        toast({ title: "Файл загружен", description: `Имя в системе: ${nameWithoutExt}` })
      } else {
        throw new Error(result.error)
      }
    } catch (error: any) {
      toast({ title: "Ошибка загрузки", description: error.message, variant: "destructive" })
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleSave = async () => {
    if (!newIvr.name || !newIvr.announcementFile) {
      toast({ title: "Ошибка", description: "Заполните название и выберите файл приветствия", variant: "destructive" })
      return
    }
    await saveIvr(newIvr)
    setIsAddOpen(false)
    setNewIvr({ id: "", name: "", announcementFile: "", digitMappings: [], timeoutDestination: "" })
    load()
    toast({ title: "Голосовое меню сохранено" })
  }

  const addMapping = () => {
    if (!tempDigit || !tempTarget) {
      toast({ title: "Ошибка", description: "Заполните кнопку и цель", variant: "destructive" })
      return
    }
    const mapping = `${tempDigit}:${tempType}:${tempTarget}`
    setNewIvr(prev => ({
      ...prev,
      digitMappings: [...(prev.digitMappings || []), mapping]
    }))
    setTempDigit("")
    setTempTarget("")
  }

  const removeMapping = (index: number) => {
    setNewIvr(prev => ({
      ...prev,
      digitMappings: (prev.digitMappings || []).filter((_, i) => i !== index)
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-primary">Голосовое меню (IVR)</h2>
          <p className="text-sm text-muted-foreground">Настройка приветствий и интерактивных переходов</p>
        </div>
        <Button onClick={() => {
          setNewIvr({ id: "", name: "", announcementFile: "", digitMappings: [], timeoutDestination: "" })
          setIsAddOpen(true)
        }} className="gap-2 shadow-lg">
          <Plus className="h-4 w-4" /> Создать IVR
        </Button>
      </div>

      <div className="grid gap-6">
        {ivrs.map(ivr => (
          <Card key={ivr.id} className="border-none shadow-lg overflow-hidden">
            <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between py-4">
              <CardTitle className="text-lg flex items-center gap-3">
                <Mic2 className="h-5 w-5 text-primary" /> {ivr.name}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => {
                  setNewIvr(ivr)
                  setIsAddOpen(true)
                }}>
                  <Settings2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => deleteIvr(ivr.id).then(load)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Аудио-файл приветствия:</p>
                  <div className="flex items-center gap-2 bg-primary/5 p-3 rounded-lg border border-primary/10">
                    <Music className="h-4 w-4 text-primary" />
                    <span className="text-xs font-mono font-bold">{ivr.announcementFile}</span>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Действие по таймауту:</p>
                  <div className="flex items-center gap-2 bg-amber-50 p-3 rounded-lg border border-amber-100">
                    <Clock className="h-4 w-4 text-amber-600" />
                    <span className="text-xs font-bold text-amber-900">
                      {ivr.timeoutDestination ? ivr.timeoutDestination.replace('Extension:', 'Сотрудник ').replace('Queue:', 'Группа ') : "Повесить трубку"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Назначения кнопок:</p>
                <div className="grid gap-2">
                  {(ivr.digitMappings || []).map((m: string, idx: number) => {
                    const parts = m.split(':');
                    if (parts.length < 3) return null;
                    const [d, type, id] = parts;
                    return (
                      <div key={idx} className="flex items-center gap-3 text-xs bg-muted/40 p-2.5 rounded border">
                        <div className="h-6 w-6 rounded bg-primary text-white flex items-center justify-center font-bold">
                          {d}
                        </div>
                        <span className="text-muted-foreground">
                          {type === 'ext' ? 'Абонент' : type === 'queue' ? 'Группа' : 'IVR'}
                        </span>
                        <span className="font-mono font-bold ml-auto">{id}</span>
                      </div>
                    )
                  })}
                  {(!ivr.digitMappings || ivr.digitMappings.length === 0) && (
                    <p className="text-xs text-muted-foreground italic text-center py-4 bg-muted/20 rounded">Кнопки не настроены</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Конфигурация IVR</DialogTitle></DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Название меню</Label>
                <Input value={newIvr.name} onChange={e => setNewIvr({...newIvr, name: e.target.value})} placeholder="Например: Секретарь" />
              </div>
              <div className="grid gap-2">
                <Label>Файл приветствия</Label>
                <div className="flex gap-2">
                  <Input 
                    value={newIvr.announcementFile} 
                    readOnly
                    placeholder="WAV или MP3"
                    className="flex-1 font-mono text-xs bg-muted/30"
                  />
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".wav,.mp3" />
                  <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="flex items-center gap-2"><Clock className="h-3 w-3" /> Если звонящий ничего не нажал (Timeout)</Label>
              <Select value={newIvr.timeoutDestination} onValueChange={v => setNewIvr({...newIvr, timeoutDestination: v})}>
                <SelectTrigger><SelectValue placeholder="Куда перевести звонок?" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hangup">Повесить трубку</SelectItem>
                  <SelectItem value="hdr-ext" disabled className="font-bold text-primary mt-2">Абоненты</SelectItem>
                  {extensions.map(e => <SelectItem key={e.id} value={`Extension:${e.id}`}>{e.id} - {e.name}</SelectItem>)}
                  <SelectItem value="hdr-q" disabled className="font-bold text-primary mt-2">Очереди</SelectItem>
                  {queues.map(q => <SelectItem key={q.id} value={`Queue:${q.name}`}>{q.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-4 border rounded-xl p-4 bg-muted/20">
              <Label className="text-[10px] font-bold uppercase text-primary flex items-center gap-2">
                <Settings2 className="h-3 w-3" /> Переходы по кнопкам
              </Label>
              
              <div className="grid gap-2 max-h-[150px] overflow-y-auto mb-4 scrollbar-none">
                {(newIvr.digitMappings || []).map((m, idx) => {
                  const parts = m.split(':');
                  if (parts.length < 3) return null;
                  const [d, t, target] = parts;
                  return (
                    <div key={idx} className="flex items-center justify-between bg-white p-2 rounded border text-xs shadow-sm">
                      <div className="flex items-center gap-2">
                        <Badge className="w-6 h-6 flex items-center justify-center p-0">{d}</Badge>
                        <span className="font-bold text-muted-foreground">{t === 'ext' ? 'Абонент' : t === 'queue' ? 'Группа' : 'IVR'}</span>
                        <span className="font-mono font-black">{target}</span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeMapping(idx)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )
                })}
              </div>

              <div className="flex gap-2">
                <Input placeholder="Кн." className="w-16" value={tempDigit} onChange={e => setTempDigit(e.target.value)} />
                <Select value={tempType} onValueChange={setTempType}>
                  <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ext">Абонент</SelectItem>
                    <SelectItem value="queue">Группа</SelectItem>
                    <SelectItem value="ivr">IVR</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={tempTarget} onValueChange={setTempTarget}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Цель" /></SelectTrigger>
                  <SelectContent>
                    {tempType === 'ext' && extensions.map(e => <SelectItem key={e.id} value={e.id}>{e.id} ({e.name})</SelectItem>)}
                    {tempType === 'queue' && queues.map(q => <SelectItem key={q.id} value={q.name}>{q.name}</SelectItem>)}
                    {tempType === 'ivr' && ivrs.filter(i => i.id !== newIvr.id).map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="secondary" onClick={addMapping}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Отмена</Button>
            <Button onClick={handleSave} className="gap-2 bg-primary">
              <CheckCircle2 className="h-4 w-4" /> Сохранить IVR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
