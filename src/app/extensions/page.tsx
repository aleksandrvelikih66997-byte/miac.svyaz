
"use client"

import { useState, useEffect } from "react"
import { Plus, Search, MoreHorizontal, User, Trash2, Edit2, Loader2, Lock, BellOff, Bell, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { getExtensions, saveExtension, deleteExtension } from "@/lib/telephony-store"

export default function ExtensionsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [newExt, setNewExt] = useState({ id: "", name: "", secret: "", tech: "PJSIP", context: "from-internal" })
  const [extensions, setExtensions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true)
    const data = await getExtensions()
    setExtensions(data)
    if (!silent) setLoading(false)
  }

  useEffect(() => {
    loadData()
    // Автообновление статусов каждые 3 секунды
    const interval = setInterval(() => loadData(true), 3000)
    return () => clearInterval(interval)
  }, [])

  const handleAdd = async () => {
    if (!newExt.id || !newExt.name || !newExt.secret) {
      toast({ title: "Ошибка", description: "Заполните все обязательные поля", variant: "destructive" })
      return
    }
    
    const extData = { ...newExt, status: "offline", dnd: false };
    await saveExtension(extData)
    setIsAddOpen(false)
    setNewExt({ id: "", name: "", secret: "", tech: "PJSIP", context: "from-internal" })
    toast({ title: "Успех", description: `Абонент ${newExt.id} добавлен` })
    loadData()
  }

  const handleDelete = async (id: string) => {
    await deleteExtension(id)
    toast({ title: "Удалено", description: `Абонент ${id} удален` })
    loadData()
  }

  const toggleDND = async (ext: any) => {
    const updated = { ...ext, dnd: !ext.dnd }
    await saveExtension(updated)
    toast({ title: updated.dnd ? "DND Включен" : "DND Выключен", description: `Статус изменен для ${ext.id}` })
    loadData()
  }

  const filtered = extensions.filter(e => 
    e.id.includes(searchTerm) || e.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-headline font-bold text-primary">Экстеншены</h2>
          <p className="text-sm text-muted-foreground">Управление внутренними номерами (Синхронизация с Asterisk 17)</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => loadData()} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Обновить
          </Button>
          <Button className="gap-2 shadow-lg" onClick={() => setIsAddOpen(true)}>
            <Plus className="h-4 w-4" /> Добавить номер
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-xl bg-card overflow-hidden">
        <CardHeader className="pb-3 border-b bg-muted/20">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Поиск по номеру или имени..." 
              className="pl-9 bg-white" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/10">
                <TableRow>
                  <TableHead className="w-[100px] font-bold">Номер</TableHead>
                  <TableHead className="font-bold">Имя / Отдел</TableHead>
                  <TableHead className="font-bold">DND</TableHead>
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
                      <div className="flex items-center gap-2">
                        <Switch checked={!!ext.dnd} onCheckedChange={() => toggleDND(ext)} />
                        {ext.dnd ? <BellOff className="h-3 w-3 text-destructive" /> : <Bell className="h-3 w-3 text-muted-foreground" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={`h-2.5 w-2.5 rounded-full ${ext.status === 'online' ? 'bg-emerald-500 animate-pulse' : ext.status === 'busy' ? 'bg-amber-500' : 'bg-slate-300'}`} />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {ext.status === 'online' ? 'В сети' : ext.status === 'busy' ? 'Занят' : 'Оффлайн'}
                        </span>
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
                          <DropdownMenuItem className="gap-2 text-destructive" onClick={() => handleDelete(ext.id)}>
                            <Trash2 className="h-4 w-4" /> Удалить
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      Абоненты не найдены
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Новый абонент</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Номер *</Label>
                <Input value={newExt.id} onChange={(e) => setNewExt({...newExt, id: e.target.value})} placeholder="101" />
              </div>
              <div className="grid gap-2">
                <Label>Технология</Label>
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
              <Label>ФИО / Отдел *</Label>
              <Input value={newExt.name} onChange={(e) => setNewExt({...newExt, name: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <Label>Пароль (Secret) *</Label>
              <Input type="password" value={newExt.secret} onChange={(e) => setNewExt({...newExt, secret: e.target.value})} />
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
