
'use server';

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { logAuditAction } from './audit-logger';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const ADMINS_FILE = path.join(DATA_DIR, 'admins.json');

function hashPassword(password: string) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export async function loginLocal(email: string, password: string) {
  try {
    if (!fs.existsSync(ADMINS_FILE)) {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
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
      return { success: false, error: 'Пользователь не найден.' };
    }

    const inputHash = hashPassword(cleanPassword);
    if (admin.passwordHash !== inputHash) {
      return { success: false, error: 'Неверный пароль.' };
    }

    const cookieStore = await cookies();
    
    cookieStore.set('miac_session', JSON.stringify({ email: admin.email, role: admin.role }), {
      httpOnly: true,
      secure: false, // Отключено для работы по HTTP (AltLinux Local)
      maxAge: 60 * 60 * 8, // 8 часов
      path: '/',
      sameSite: 'lax'
    });

    await logAuditAction('LOGIN', `Вход в систему: ${admin.email}`);
    return { success: true };
  } catch (error: any) {
    console.error(`[AUTH] Server error:`, error);
    return { success: false, error: `Ошибка сервера: ${error.message}` };
  }
}

export async function logoutLocal() {
  const session = await getLocalSession();
  if (session) {
    await logAuditAction('LOGOUT', `Выход из системы: ${session.email}`);
  }
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

export async function getAdmins() {
  try {
    if (!fs.existsSync(ADMINS_FILE)) return [];
    return JSON.parse(fs.readFileSync(ADMINS_FILE, 'utf8')).map((a: any) => ({
      email: a.email,
      role: a.role,
      createdAt: a.createdAt
    }));
  } catch {
    return [];
  }
}

export async function createAdmin(email: string, password: string) {
  try {
    const admins = JSON.parse(fs.readFileSync(ADMINS_FILE, 'utf8'));
    const cleanEmail = email.trim().toLowerCase();
    
    if (admins.some((a: any) => a.email === cleanEmail)) {
      return { success: false, error: 'Пользователь уже существует' };
    }

    const newAdmin = {
      email: cleanEmail,
      passwordHash: hashPassword(password),
      role: "Admin",
      createdAt: new Date().toISOString()
    };

    admins.push(newAdmin);
    fs.writeFileSync(ADMINS_FILE, JSON.stringify(admins, null, 2));
    
    await logAuditAction('CREATE_ADMIN', `Создан администратор: ${cleanEmail}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteAdmin(email: string) {
  try {
    const admins = JSON.parse(fs.readFileSync(ADMINS_FILE, 'utf8'));
    if (admins.length <= 1) {
      return { success: false, error: 'Нельзя удалить последнего администратора' };
    }

    const currentSession = await getLocalSession();
    if (currentSession?.email === email) {
      return { success: false, error: 'Нельзя удалить самого себя' };
    }

    const filtered = admins.filter((a: any) => a.email !== email);
    fs.writeFileSync(ADMINS_FILE, JSON.stringify(filtered, null, 2));
    
    await logAuditAction('DELETE_ADMIN', `Удален администратор: ${email}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
