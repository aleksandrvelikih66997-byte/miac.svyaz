
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
      return { success: false, error: 'Система не настроена.' };
    }

    const admins = JSON.parse(fs.readFileSync(ADMINS_FILE, 'utf8'));
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    
    const admin = admins.find((a: any) => a.email.toLowerCase() === cleanEmail);

    if (!admin) {
      return { success: false, error: 'Пользователь не найден.' };
    }

    const inputHash = hashPassword(cleanPassword);
    
    if (admin.passwordHash !== inputHash) {
      return { success: false, error: 'Неверный логин или пароль.' };
    }

    const cookieStore = await cookies();
    
    // Настройки для Cloud Workstations (HTTPS + Iframe)
    // ВАЖНО: sameSite: 'none' и secure: true обязательны в этой среде
    cookieStore.set('miac_session', JSON.stringify({ email: admin.email, role: admin.role }), {
      httpOnly: true,
      secure: true, 
      maxAge: 60 * 60 * 24, 
      path: '/',
      sameSite: 'none'
    });

    return { success: true };
  } catch (error: any) {
    console.error('Login Error:', error);
    return { success: false, error: error.message };
  }
}

export async function logoutLocal() {
  const cookieStore = await cookies();
  cookieStore.delete('miac_session');
}

export async function getLocalSession() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('miac_session');
    if (!session) return null;
    return JSON.parse(session.value);
  } catch {
    return null;
  }
}
