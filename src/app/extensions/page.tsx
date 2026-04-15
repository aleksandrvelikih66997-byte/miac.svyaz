
"use client"

import { useState } from "react"
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  Phone, 
  User, 
  Shield, 
  Trash2,
  Edit2
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const extensions = [
  { id: "101", name: "Иван Иванов", tech: "PJSIP", status: "online", context: "from-internal" },
  { id: "102", name: "Сергей Петров", tech: "PJSIP", status: "online", context: "from-internal" },
  { id: "103", name: "Анна Смирнова", tech: "SIP", status: "offline", context: "from-internal" },
  { id: "104", name: "Отдел продаж", tech: "Queue", status: "online", context: "sales-flow" },
  { id: "105", name: "Техподдержка", tech: "Queue", status: "busy", context: "support-flow" },
]

export default function ExtensionsPage() {
  const [searchTerm, setSearchTerm] = useState("")

  const filtered = extensions.filter(e => 
    e.id.includes(searchTerm) || e.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-headline font-bold">Экстеншены</h2>
          <p className="text-sm text-muted-foreground">Управление внутренними номерами и пользователями</p>
        </div>
        <Button className="gap-2">
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
                        <DropdownMenuItem className="gap-2 text-destructive">
                          <Trash2 className="h-4 w-4" /> Удалить
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
