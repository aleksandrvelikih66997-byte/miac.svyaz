
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Globe, ShieldCheck, Wifi, MoreVertical, ExternalLink, Trash2, Loader2, Lock, Hash, Settings2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc, setDoc, deleteDoc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"

export default function TrunksPage() {
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [newTrunk, setNewTrunk] = useState({ 
    name: "", 
    host: "", 
    port: "5060", 
    user: "", 
    password: "", 
    protocol: "udp", 
    phone: "" 
  })
  const db = useFirestore()
  const { toast } = useToast()

  const trunksRef = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, "trunks")
  }, [db])
  const { data: trunks, loading } = useCollection(trunksRef)

  const handleAdd = () => {
    if (!newTrunk.name || !newTrunk.host || !newTrunk.user || !newTrunk.password) {
      toast({ title: "Ошибка", description: "Заполните обязательные поля (Имя, Хост, Логин, Пароль)", variant: "destructive" })
      return
    }
    
    const id = newTrunk.name.toLowerCase().replace(/\s+/g, '-')
    const trunkData = {
      ...newTrunk,
      port: parseInt(newTrunk.port) || 5060,
      status: "Unregistered",
      channels: "0/0"
    }

    setDoc(doc(db, "trunks", id), trunkData)
      .then(() => {
        setIsAddOpen(false)
        setNewTrunk({ name: "", host: "", port: "5060", user: "", password: "", protocol: "udp", phone: "" })
        toast({ title: "Транк добавлен" })
      })
      .catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: `trunks/${id}`,
          operation: 'create',
          requestResourceData: trunkData
        }))
      })
  }

  const handleDelete = (id: string) => {
    deleteDoc(doc(db, "trunks", id))
      .then(() => {
        toast({ title: "Транк удален" })
      })
      .catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: `trunks/${id}`,
          operation: 'delete'
        }))
      })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-headline font-bold">Транки (SIP/PJSIP)</h2>
          <p className="text-sm text-muted-foreground">Настройка внешних линий и провайдеров</p>
        </div>
        <Button className="gap-2" onClick={() => setIsAddOpen(true)}>
          <Plus className="h-4 w-4" /> Добавить транк
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {trunks?.map((trunk: any) => (
            <Card key={trunk.id} className="border-none shadow-sm overflow-hidden group">
              <CardHeader className="bg-muted/30 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Globe className="h-5 w-5" />
                  </div>
                  <Badge variant={trunk.status === "Registered" ? "default" : "destructive"} className={trunk.status === "Registered" ? "bg-emerald-500 hover:bg-emerald-600" : ""}>
                    {trunk.status === "Registered" ? "Активен" : "Ошибка"}
                  </Badge>
                </div>
                <CardTitle className="pt-4 text-lg font-headline">{trunk.name}</CardTitle>
                <CardDescription className="font-mono text-xs flex items-center gap-1">
                  {trunk.host}:{trunk.port} <Badge variant="outline" className="text-[9px] h-4">{trunk.protocol}</Badge>
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5"><ShieldCheck className="h-3 w-3" /> Логин:</span>
                    <span className="font-medium">{trunk.user}</span>
                  </div>
                  {trunk.phone && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1.5"><Hash className="h-3 w-3" /> Номер:</span>
                      <span className="font-medium">{trunk.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5"><Wifi className="h-3 w-3" /> Каналы:</span>
                    <span className="font-medium">{trunk.channels}</span>
                  </div>
                </div>
                
                <div className="pt-4 border-t flex items-center justify-between">
                  <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
                    Настройки <ExternalLink className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(trunk.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Новый SIP Транк</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Название *</Label>
                <Input value={newTrunk.name} onChange={e => setNewTrunk({...newTrunk, name: e.target.value})} placeholder="Beeline" />
              </div>
              <div className="grid gap-2">
                <Label>Протокол</Label>
                <Select value={newTrunk.protocol} onValueChange={v => setNewTrunk({...newTrunk, protocol: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="udp">UDP</SelectItem>
                    <SelectItem value="tcp">TCP</SelectItem>
                    <SelectItem value="tls">TLS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-3 grid gap-2">
                <Label>Host / IP *</Label>
                <Input value={newTrunk.host} onChange={e => setNewTrunk({...newTrunk, host: e.target.value})} placeholder="sip.beeline.ru" />
              </div>
              <div className="grid gap-2">
                <Label>Порт</Label>
                <Input value={newTrunk.port} onChange={e => setNewTrunk({...newTrunk, port: e.target.value})} placeholder="5060" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Логин / Username *</Label>
                <Input value={newTrunk.user} onChange={e => setNewTrunk({...newTrunk, user: e.target.value})} placeholder="7495..." />
              </div>
              <div className="grid gap-2">
                <Label>Пароль *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="password" value={newTrunk.password} onChange={e => setNewTrunk({...newTrunk, password: e.target.value})} className="pl-9" placeholder="••••••••" />
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Внешний номер (DID)</Label>
              <Input value={newTrunk.phone} onChange={e => setNewTrunk({...newTrunk, phone: e.target.value})} placeholder="+7 (495) 000-00-00" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Отмена</Button>
            <Button onClick={handleAdd}>Создать</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
