"use client"

import { useState } from "react"
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  User, 
  Shield, 
  Trash2,
  Edit2,
  Loader2,
  Lock
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc, setDoc, deleteDoc, query, orderBy } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"

export default function ExtensionsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [newExt, setNewExt] = useState({ id: "", name: "", secret: "", tech: "PJSIP", context: "from-internal" })
  const db = useFirestore()
  const { toast } = useToast()

  const extensionsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "extensions"), orderBy("id", "asc"));
  }, [db]);

  const { data: extensions, loading } = useCollection(extensionsQuery)

  const handleAdd = () => {
    if (!newExt.id || !newExt.name || !newExt.secret) {
      toast({ title: "Ошибка", description: "Заполните все обязательные поля", variant: "destructive" })
      return
    }
    
    const extData = {
      ...newExt,
      status: "offline"
    };

    setDoc(doc(db, "extensions", newExt.id), extData)
      .catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: `extensions/${newExt.id}`,
          operation: 'create',
          requestResourceData: extData
        }))
      });
    
    setIsAddOpen(false)
    setNewExt({ id: "", name: "", secret: "", tech: "PJSIP", context: "from-internal" })
    toast({ title: "Успех", description: `Абонент ${newExt.id} добавлен` })
  }

  const handleDelete = (id: string) => {
    deleteDoc(doc(db, "extensions", id))
      .catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: `extensions/${id}`,
          operation: 'delete'
        }))
      });
    toast({ title: "Удалено", description: `Абонент ${id} удален` })
  }

  const filtered = extensions?.filter(e => 
    e.id.includes(searchTerm) || e.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-headline font-bold text-primary">Экстеншены</h2>
          <p className="text-sm text-muted-foreground">Управление внутренними номерами МИАЦ</p>
        </div>
        <Button className="gap-2 shadow-lg" onClick={() => setIsAddOpen(true)}>
          <Plus className="h-4 w-4" /> Добавить номер
        </Button>
      </div>

      <Card className="border-none shadow-xl bg-card overflow-hidden">
        <CardHeader className="pb-3 border-b bg-muted/20">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Поиск по номеру или имени..." 
                className="pl-9 bg-white" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/10">
                <TableRow>
                  <TableHead className="w-[120px] font-bold">Номер</TableHead>
                  <TableHead className="font-bold">Имя / Отдел</TableHead>
                  <TableHead className="font-bold">Технология</TableHead>
                  <TableHead className="font-bold">Статус</TableHead>
                  <TableHead className="text-right font-bold">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((ext) => (
                  <TableRow key={ext.id} className="hover:bg-muted/5 transition-colors">
                    <TableCell className="font-mono font-bold text-primary">{ext.id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                           <User className="h-4 w-4" />
                        </div>
                        <span className="font-medium">{ext.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px] bg-slate-50">
                        {ext.tech}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${ext.status === 'online' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        <span className="text-xs font-medium uppercase">{ext.status}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="gap-2">
                            <Edit2 className="h-4 w-4" /> Редактировать
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="gap-2 text-destructive" onClick={() => handleDelete(ext.id)}>
                            <Trash2 className="h-4 w-4" /> Удалить
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Plus className="h-5 w-5" /> Новый абонент
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-xs font-bold uppercase">Номер *</Label>
                <Input value={newExt.id} onChange={(e) => setNewExt({...newExt, id: e.target.value})} placeholder="101" />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs font-bold uppercase">Технология</Label>
                <Select value={newExt.tech} onValueChange={(v) => setNewExt({...newExt, tech: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PJSIP">PJSIP (AltLinux)</SelectItem>
                    <SelectItem value="SIP">Legacy SIP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-bold uppercase">ФИО / Отдел *</Label>
              <Input value={newExt.name} onChange={(e) => setNewExt({...newExt, name: e.target.value})} placeholder="Иван Иванов" />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-bold uppercase">Пароль (Secret) *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="password" value={newExt.secret} onChange={(e) => setNewExt({...newExt, secret: e.target.value})} className="pl-9" placeholder="••••••••" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-bold uppercase">Контекст</Label>
              <Input value={newExt.context} onChange={(e) => setNewExt({...newExt, context: e.target.value})} placeholder="from-internal" />
            </div>
          </div>
          <DialogFooter className="bg-muted/10 p-4 -mx-6 -mb-6">
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Отмена</Button>
            <Button onClick={handleAdd}>Создать номер</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
