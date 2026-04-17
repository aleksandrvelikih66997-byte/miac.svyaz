
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PhoneCall, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { loginLocal } from '@/lib/auth-local';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const result = await loginLocal(email, password);
      
      if (result.success) {
        toast({ title: "Успешный вход", description: "Перенаправление..." });
        // Прямой редирект для облачных сред
        setTimeout(() => {
          window.location.assign('/');
        }, 100);
      } else {
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: result.error || "Неверные данные",
        });
        setLoading(false);
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Проблема связи с сервером.",
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 bg-slate-50">
      <div className="w-full max-w-[400px] space-y-8">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg">
            <PhoneCall className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-primary">МИАЦ.СВЯЗЬ</h1>
          <p className="text-sm text-muted-foreground">AltLinux SP 10 Administration</p>
        </div>

        <Card className="border-none shadow-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Вход
            </CardTitle>
            <CardDescription>Введите данные администратора</CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="velikih@miackuban.ru"
                  className="bg-white"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Пароль</Label>
                <Input 
                  id="password" 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-white"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Войти"}
              </Button>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg text-[10px] text-muted-foreground w-full">
                <AlertCircle className="h-3 w-3" />
                <span>Авторизация для Cloud Workstations (As134679)</span>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
