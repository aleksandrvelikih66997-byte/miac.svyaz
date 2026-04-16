
'use server';

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { cookies } from 'next/headers';

const ADMINS_FILE = path.join(process.cwd(), 'src/data/admins.json');

function hashPassword(password: string) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export async function loginLocal(email: string, password: string) {
  try {
    if (!fs.existsSync(ADMINS_FILE)) {
      return { success: false, error: 'Система не настроена. Создайте админа через консоль сервера.' };
    }

    const admins = JSON.parse(fs.readFileSync(ADMINS_FILE, 'utf8'));
    const admin = admins.find((a: any) => a.email === email);

    if (!admin || admin.passwordHash !== hashPassword(password)) {
      return { success: false, error: 'Неверный логин или пароль.' };
    }

    const cookieStore = await cookies();
    
    // ВАЖНО: secure: false ОБЯЗАТЕЛЕН для работы по IP (HTTP)
    // Мы также добавляем sameSite: 'lax' для стабильности
    cookieStore.set('miac_session', JSON.stringify({ email: admin.email, role: admin.role }), {
      httpOnly: true,
      secure: false, 
      maxAge: 60 * 60 * 24, // 1 день
      path: '/',
      sameSite: 'lax'
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function logoutLocal() {
  const cookieStore = await cookies();
  cookieStore.delete('miac_session');
}

export async function getLocalSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get('miac_session');
  if (!session) return null;
  try {
    return JSON.parse(session.value);
  } catch {
    return null;
  }
}
