
"use client"

import { useState, useEffect } from "react"
import { Plus, Search, MoreHorizontal, User, Trash2, Edit2, Loader2, Lock, BellOff, Bell, RefreshCw, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { getExtensions, saveExtension, deleteExtension } from "@/lib/telephony-store"

export default function ExtensionsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [currentExt, setCurrentExt] = useState({ id: "", name: "", secret: "", tech: "PJSIP", context: "from-internal" })
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
    const interval = setInterval(() => loadData(true), 5000)
    return () => clearInterval(interval)
  }, [])

  const handleOpenAdd = () => {
    setIsEditing(false)
    setCurrentExt({ id: "", name: "", secret: "", tech: "PJSIP", context: "from-internal" })
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (ext: any) => {
    setIsEditing(true)
    setCurrentExt(ext)
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!currentExt.id || !currentExt.name || !currentExt.secret) {
      toast({ title: "Ошибка", description: "Заполните все обязательные поля", variant: "destructive" })
      return
    }
    
    await saveExtension({ ...currentExt, status: currentExt.id === '100' ? 'online' : 'offline' })
    setIsDialogOpen(false)
    toast({ title: "Успешно", description: isEditing ? "Данные обновлены" : "Абонент создан" })
    loadData()
  }

  const handleDelete = async (id: string) => {
    await deleteExtension(id)
    toast({ title: "Удалено", description: `Абонент ${id} удален` })
    loadData()
  }

  const filtered = extensions.filter(e => 
    e.id.includes(searchTerm) || e.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-headline font-bold text-primary">Абоненты</h2>
          <p className="text-sm text-muted-foreground">Управление внутренними номерами (PJSIP)</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => loadData()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button className="gap-2 shadow-lg" onClick={handleOpenAdd}>
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
                  <TableHead className="font-bold">Контекст</TableHead>
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
                    <TableCell className="text-xs font-mono">{ext.context}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={`h-2.5 w-2.5 rounded-full ${ext.id === '100' || ext.id === '123' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-300'}`} />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {ext.id === '100' || ext.id === '123' ? 'В сети' : 'Оффлайн'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => handleOpenEdit(ext)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
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
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{isEditing ? `Редактирование ${currentExt.id}` : 'Новый абонент'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Номер *</Label>
                <Input 
                  value={currentExt.id} 
                  disabled={isEditing}
                  onChange={(e) => setCurrentExt({...currentExt, id: e.target.value})} 
                  placeholder="101" 
                />
              </div>
              <div className="grid gap-2">
                <Label>Технология</Label>
                <Select value={currentExt.tech} onValueChange={(v) => setCurrentExt({...currentExt, tech: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PJSIP">PJSIP</SelectItem>
                    <SelectItem value="SIP">Legacy SIP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>ФИО / Отдел *</Label>
              <Input value={currentExt.name} onChange={(e) => setCurrentExt({...currentExt, name: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <Label>Пароль (Secret) *</Label>
              <div className="relative">
                <Input 
                  type="text" 
                  value={currentExt.secret} 
                  onChange={(e) => setCurrentExt({...currentExt, secret: e.target.value})} 
                  className="pr-10"
                />
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Контекст</Label>
              <Input value={currentExt.context} onChange={(e) => setCurrentExt({...currentExt, context: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Отмена</Button>
            <Button onClick={handleSave} className="gap-2">
              <CheckCircle2 className="h-4 w-4" /> Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
