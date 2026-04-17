
"use client"

import { useState, useEffect } from "react"
import { Plus, Search, User, Trash2, Edit2, Loader2, Lock, Info, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
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
    try {
      const data = await getExtensions()
      setExtensions(data || [])
    } catch (e) {
      console.error(e)
    } finally {
      if (!silent) setLoading(false)
    }
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
    setCurrentExt({ ...ext })
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!currentExt.id || !currentExt.name || !currentExt.secret) {
      toast({ title: "Ошибка", description: "Заполните все обязательные поля", variant: "destructive" })
      return
    }
    await saveExtension(currentExt)
    setIsDialogOpen(false)
    toast({ title: "Успешно", description: isEditing ? "Данные обновлены" : "Абонент создан" })
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
          <p className="text-sm text-muted-foreground">Управление внутренними номерами системы</p>
        </div>
        <div className="flex items-center gap-3">
          <Button className="gap-2 shadow-lg" onClick={handleOpenAdd}>
            <Plus className="h-4 w-4" /> Добавить номер
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <div className="md:col-span-3">
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
                      <TableHead className="font-bold">Технология</TableHead>
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
                        <TableCell><Badge variant="outline">{ext.tech}</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => handleOpenEdit(ext)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteExtension(ext.id).then(() => loadData())}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-amber-50 border-amber-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-amber-700">
                <Info className="h-4 w-4" /> Настройка телефона
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-3 text-amber-900">
              <p>Для корректной работы Yealink, MicroSIP или Zoiper:</p>
              <ul className="list-disc pl-4 space-y-2">
                <li><strong>SIP Server:</strong> IP вашего сервера</li>
                <li><strong>User ID:</strong> Номер</li>
                <li><strong>Auth ID:</strong> ОБЯЗАТЕЛЬНО номер</li>
                <li><strong>Password:</strong> Секрет из настроек</li>
              </ul>
              <p className="font-bold border-t border-amber-200 pt-2 text-rose-700">Внимание Yealink!</p>
              <p>Убедитесь, что в поле Label и Display Name указан номер абонента.</p>
            </CardContent>
          </Card>
        </div>
      </div>

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
                    <SelectItem value="PJSIP">PJSIP (Рекомендуется)</SelectItem>
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
                  type="password"
                  value={currentExt.secret} 
                  onChange={(e) => setCurrentExt({...currentExt, secret: e.target.value})} 
                />
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
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
