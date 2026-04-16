
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
  Loader2
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
import { useFirestore, useCollection } from "@/firebase"
import { collection, doc, setDoc, deleteDoc, query, orderBy } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"

export default function ExtensionsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [newExt, setNewExt] = useState({ id: "", name: "", tech: "PJSIP", context: "from-internal" })
  const db = useFirestore()
  const { toast } = useToast()

  const extensionsQuery = query(collection(db, "extensions"), orderBy("id", "asc"))
  const { data: extensions, loading } = useCollection(extensionsQuery)

  const handleAdd = async () => {
    if (!newExt.id || !newExt.name) return
    try {
      await setDoc(doc(db, "extensions", newExt.id), {
        ...newExt,
        status: "offline"
      })
      setIsAddOpen(false)
      setNewExt({ id: "", name: "", tech: "PJSIP", context: "from-internal" })
      toast({ title: "Успех", description: `Абонент ${newExt.id} добавлен` })
    } catch (e) {
      toast({ title: "Ошибка", variant: "destructive" })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "extensions", id))
      toast({ title: "Удалено", description: `Абонент ${id} удален` })
    } catch (e) {
      toast({ title: "Ошибка", variant: "destructive" })
    }
  }

  const filtered = extensions?.filter(e => 
    e.id.includes(searchTerm) || e.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-headline font-bold">Экстеншены</h2>
          <p className="text-sm text-muted-foreground">Управление внутренними номерами и пользователями</p>
        </div>
        <Button className="gap-2" onClick={() => setIsAddOpen(true)}>
          <Plus className="h-4 w-4" /> Добавить номер
        </Button>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Поиск по номеру или имени..." 
                className="pl-9" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline">Фильтры</Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Номер</TableHead>
                  <TableHead>Имя / Описание</TableHead>
                  <TableHead>Протокол</TableHead>
                  <TableHead>Контекст</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((ext) => (
                  <TableRow key={ext.id}>
                    <TableCell className="font-mono font-medium">{ext.id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3 text-muted-foreground" />
                        {ext.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal uppercase text-[10px]">
                        {ext.tech}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{ext.context}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <div className={`h-1.5 w-1.5 rounded-full ${
                          ext.status === 'online' ? 'bg-emerald-500' : 
                          ext.status === 'busy' ? 'bg-amber-500' : 'bg-slate-300'
                        }`} />
                        <span className="text-xs capitalize">{ext.status}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="gap-2">
                            <Edit2 className="h-4 w-4" /> Редактировать
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2">
                            <Shield className="h-4 w-4" /> Безопасность
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый абонент</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="num">Внутренний номер</Label>
              <Input id="num" value={newExt.id} onChange={(e) => setNewExt({...newExt, id: e.target.value})} placeholder="101" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">ФИО / Отдел</Label>
              <Input id="name" value={newExt.name} onChange={(e) => setNewExt({...newExt, name: e.target.value})} placeholder="Иван Иванов" />
            </div>
            <div className="grid gap-2">
              <Label>Технология</Label>
              <Select value={newExt.tech} onValueChange={(v) => setNewExt({...newExt, tech: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PJSIP">PJSIP</SelectItem>
                  <SelectItem value="SIP">Legacy SIP</SelectItem>
                </SelectContent>
              </Select>
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
