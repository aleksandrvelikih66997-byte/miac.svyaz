
/**
 * @fileOverview Скрипт создания локального администратора
 * Использование: node src/scripts/setup-admin.mjs email@miac.ru password
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.log('Использование: node src/scripts/setup-admin.mjs <email> <password>');
  process.exit(1);
}

const DATA_DIR = path.join(process.cwd(), 'src/data');
const ADMINS_FILE = path.join(DATA_DIR, 'admins.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function hashPassword(pass) {
  return crypto.createHash('sha256').update(pass).digest('hex');
}

let admins = [];
if (fs.existsSync(ADMINS_FILE)) {
  admins = JSON.parse(fs.readFileSync(ADMINS_FILE, 'utf8'));
}

const existingIndex = admins.findIndex(a => a.email === email);
const adminData = {
  email,
  passwordHash: hashPassword(password),
  role: 'Admin',
  createdAt: new Date().toISOString()
};

if (existingIndex > -1) {
  admins[existingIndex] = adminData;
  console.log(`[OK] Пароль администратора ${email} обновлен.`);
} else {
  admins.push(adminData);
  console.log(`[OK] Администратор ${email} создан.`);
}

fs.writeFileSync(ADMINS_FILE, JSON.stringify(admins, null, 2));
