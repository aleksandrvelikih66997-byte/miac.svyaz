
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Globe, ShieldCheck, Wifi, ExternalLink, Trash2, Loader2, Lock, Hash, Edit3 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { getTrunks, saveTrunk, deleteTrunk } from "@/lib/telephony-store"

export default function TrunksPage() {
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [newTrunk, setNewTrunk] = useState({ 
    id: "",
    name: "", 
    host: "", 
    port: "5060", 
    user: "", 
    password: "", 
    protocol: "udp", 
    phone: "",
    status: "Offline"
  })
  const [trunks, setTrunks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const loadTrunks = async () => {
    setLoading(true)
    try {
      const data = await getTrunks()
      setTrunks(data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTrunks()
    const int = setInterval(loadTrunks, 10000)
    return () => clearInterval(int)
  }, [])

  const handleOpenAdd = () => {
    setIsEditing(false)
    setNewTrunk({ id: "", name: "", host: "", port: "5060", user: "", password: "", protocol: "udp", phone: "", status: "Offline" })
    setIsAddOpen(true)
  }

  const handleOpenEdit = (trunk: any) => {
    setIsEditing(true)
    setNewTrunk({ ...trunk })
    setIsAddOpen(true)
  }

  const handleSave = async () => {
    if (!newTrunk.name || !newTrunk.host || !newTrunk.user || !newTrunk.password) {
      toast({ title: "Ошибка", description: "Заполните обязательные поля", variant: "destructive" })
      return
    }
    
    await saveTrunk(newTrunk)
    setIsAddOpen(false)
    toast({ title: isEditing ? "Транк обновлен" : "Транк добавлен" })
    loadTrunks()
  }

  const handleDelete = async (id: string) => {
    await deleteTrunk(id)
    toast({ title: "Транк удален" })
    loadTrunks()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-headline font-bold text-primary">Внешние линии (Транки)</h2>
          <p className="text-sm text-muted-foreground">Настройка SIP/PJSIP подключения к провайдерам связи</p>
        </div>
        <Button className="gap-2 shadow-lg" onClick={handleOpenAdd}>
          <Plus className="h-4 w-4" /> Добавить транк
        </Button>
      </div>

      {loading && trunks.length === 0 ? (
        <div className="flex justify-center py-24"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {trunks.map((trunk: any) => (
            <Card key={trunk.id} className="border-none shadow-xl overflow-hidden group hover:scale-[1.01] transition-transform">
              <CardHeader className="bg-muted/30 pb-4 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-inner">
                    <Globe className="h-6 w-6" />
                  </div>
                  <Badge variant="default" className="bg-emerald-500">
                    Активен (Registered)
                  </Badge>
                </div>
                <CardTitle className="pt-4 text-xl font-headline text-primary">{trunk.name}</CardTitle>
                <CardDescription className="font-mono text-xs flex items-center gap-2 mt-1">
                  {trunk.host}:{trunk.port} 
                  <Badge variant="outline" className="text-[9px] h-4 font-mono bg-white uppercase">{trunk.protocol}</Badge>
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm p-2 rounded bg-muted/20">
                    <span className="text-muted-foreground flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Логин:</span>
                    <span className="font-mono font-bold">{trunk.user}</span>
                  </div>
                  {trunk.phone && (
                    <div className="flex items-center justify-between text-sm p-2 rounded bg-muted/20">
                      <span className="text-muted-foreground flex items-center gap-2"><Hash className="h-4 w-4 text-primary" /> Номер DID:</span>
                      <span className="font-mono font-bold text-emerald-700">{trunk.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm p-2 rounded bg-muted/20">
                    <span className="text-muted-foreground flex items-center gap-2"><Wifi className="h-4 w-4 text-primary" /> Протокол:</span>
                    <span className="font-medium uppercase">{trunk.protocol}</span>
                  </div>
                </div>
                
                <div className="pt-4 border-t flex items-center justify-between">
                  <Button variant="ghost" size="sm" className="h-9 gap-2 text-xs hover:bg-primary/5 text-primary" onClick={() => handleOpenEdit(trunk)}>
                    Настроить <Edit3 className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(trunk.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {trunks.length === 0 && (
            <Card className="col-span-full border-dashed border-2 py-12 flex flex-col items-center justify-center text-muted-foreground">
              <Globe className="h-12 w-12 opacity-10 mb-4" />
              <p>Нет настроенных транков</p>
              <Button variant="link" onClick={handleOpenAdd}>Создать первый транк</Button>
            </Card>
          )}
        </div>
      )}

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
               {isEditing ? <Edit3 className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />} 
               {isEditing ? `Редактирование: ${newTrunk.name}` : 'Новый SIP/PJSIP Транк'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-xs font-bold uppercase tracking-wider">Название *</Label>
                <Input value={newTrunk.name} onChange={e => setNewTrunk({...newTrunk, name: e.target.value})} placeholder="Rostelecom" />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs font-bold uppercase tracking-wider">Протокол</Label>
                <Select value={newTrunk.protocol} onValueChange={v => setNewTrunk({...newTrunk, protocol: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="udp">UDP (Стандарт)</SelectItem>
                    <SelectItem value="tcp">TCP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-3 grid gap-2">
                <Label className="text-xs font-bold uppercase tracking-wider">Host / IP *</Label>
                <Input value={newTrunk.host} onChange={e => setNewTrunk({...newTrunk, host: e.target.value})} placeholder="192.168.0.140" />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs font-bold uppercase tracking-wider">Порт</Label>
                <Input value={newTrunk.port} onChange={e => setNewTrunk({...newTrunk, port: e.target.value})} placeholder="5060" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-xs font-bold uppercase tracking-wider">Логин / Username *</Label>
                <Input value={newTrunk.user} onChange={e => setNewTrunk({...newTrunk, user: e.target.value})} placeholder="100" />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs font-bold uppercase tracking-wider">Пароль *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="password" value={newTrunk.password} onChange={e => setNewTrunk({...newTrunk, password: e.target.value})} className="pl-9" placeholder="••••••••" />
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-xs font-bold uppercase tracking-wider">Внешний номер (DID)</Label>
              <Input value={newTrunk.phone} onChange={e => setNewTrunk({...newTrunk, phone: e.target.value})} placeholder="74950000000" />
            </div>
          </div>
          <DialogFooter className="bg-muted/10 p-4 -mx-6 -mb-6">
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Отмена</Button>
            <Button onClick={handleSave} className="bg-primary hover:bg-primary/90">
              {isEditing ? 'Обновить данные' : 'Создать транк'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
