
'use server';

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { cookies } from 'next/headers';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const ADMINS_FILE = path.join(DATA_DIR, 'admins.json');

function hashPassword(password: string) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export async function loginLocal(email: string, password: string) {
  try {
    if (!fs.existsSync(ADMINS_FILE)) {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      // Устанавливаем дефолтный пароль As134679 если файла нет
      const defaultAdmin = [{
        email: "velikih@miackuban.ru",
        passwordHash: hashPassword("As134679"),
        role: "Admin",
        createdAt: new Date().toISOString()
      }];
      fs.writeFileSync(ADMINS_FILE, JSON.stringify(defaultAdmin, null, 2));
    }

    const admins = JSON.parse(fs.readFileSync(ADMINS_FILE, 'utf8'));
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    
    const admin = admins.find((a: any) => a.email.toLowerCase() === cleanEmail);

    if (!admin) {
      console.log(`[AUTH] User not found: ${cleanEmail}`);
      return { success: false, error: 'Пользователь не найден.' };
    }

    const inputHash = hashPassword(cleanPassword);
    if (admin.passwordHash !== inputHash) {
      console.log(`[AUTH] Invalid password for: ${cleanEmail}`);
      return { success: false, error: 'Неверный пароль.' };
    }

    const cookieStore = await cookies();
    
    // ВАЖНО: для работы по HTTP (10.0.2.82) secure должно быть false
    cookieStore.set('miac_session', JSON.stringify({ email: admin.email, role: admin.role }), {
      httpOnly: true,
      secure: false, // Отключаем secure для HTTP
      maxAge: 60 * 60 * 24, 
      path: '/',
      sameSite: 'lax'
    });

    console.log(`[AUTH] Success: ${cleanEmail}`);
    return { success: true };
  } catch (error: any) {
    console.error(`[AUTH] Server error:`, error);
    return { success: false, error: `Ошибка сервера: ${error.message}` };
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
