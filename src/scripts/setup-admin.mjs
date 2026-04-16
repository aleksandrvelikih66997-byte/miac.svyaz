
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * @fileOverview Скрипт создания локального администратора панели управления.
 * Используется для первичной настройки системы.
 */

const ADMINS_FILE = 'src/data/admins.json';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('\x1b[33m%s\x1b[0m', 'Использование: node src/scripts/setup-admin.mjs <email> <password>');
  process.exit(1);
}

const [email, password] = args;

// Гарантируем наличие папки
const dir = path.dirname(ADMINS_FILE);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

let admins = [];
if (fs.existsSync(ADMINS_FILE)) {
  try {
    admins = JSON.parse(fs.readFileSync(ADMINS_FILE, 'utf8'));
  } catch (e) {
    admins = [];
  }
}

const existingIndex = admins.findIndex(a => a.email === email);
const adminData = {
  email,
  passwordHash: hashPassword(password),
  role: 'Admin',
  createdAt: new Date().toISOString()
};

if (existingIndex >= 0) {
  admins[existingIndex] = adminData;
  console.log(`\x1b[32m[OK] Администратор ${email} обновлен.\x1b[0m`);
} else {
  admins.push(adminData);
  console.log(`\x1b[32m[OK] Администратор ${email} успешно создан.\x1b[0m`);
}

fs.writeFileSync(ADMINS_FILE, JSON.stringify(admins, null, 2));
