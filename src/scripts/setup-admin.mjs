
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * @fileOverview Скрипт создания администраторов.
 * Использование: node src/scripts/setup-admin.mjs admin@miac.ru myPassword123
 */

const DATA_DIR = path.join(process.cwd(), 'src/data');
const ADMINS_FILE = path.join(DATA_DIR, 'admins.json');

const [,, email, password] = process.argv;

if (!email || !password) {
  console.log('Использование: node setup-admin.mjs <email> <password>');
  process.exit(1);
}

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
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
  console.log(`👤 Администратор ${email} обновлен.`);
} else {
  admins.push(adminData);
  console.log(`👤 Администратор ${email} успешно создан.`);
}

fs.writeFileSync(ADMINS_FILE, JSON.stringify(admins, null, 2));
console.log('✅ Данные сохранены в src/data/admins.json');
