
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Скрипт для создания администратора панели управления.
 * Использование: npx tsx src/scripts/setup-admin.ts user@miac.ru password
 */

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.log('Использование: npm run setup-admin <email> <password>');
  process.exit(1);
}

const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const ADMINS_FILE = path.join(DATA_DIR, 'admins.json');

function hashPassword(p: string) {
  return crypto.createHash('sha256').update(p.trim()).digest('hex');
}

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let admins = [];
if (fs.existsSync(ADMINS_FILE)) {
  const content = fs.readFileSync(ADMINS_FILE, 'utf8');
  admins = content ? JSON.parse(content) : [];
}

const cleanEmail = email.trim().toLowerCase();
const newAdmin = {
  email: cleanEmail,
  passwordHash: hashPassword(password),
  role: "Admin",
  createdAt: new Date().toISOString()
};

const existingIndex = admins.findIndex((a: any) => a.email.toLowerCase() === cleanEmail);
if (existingIndex > -1) {
  admins[existingIndex] = newAdmin;
} else {
  admins.push(newAdmin);
}

fs.writeFileSync(ADMINS_FILE, JSON.stringify(admins, null, 2));
console.log(`[AUTH] Администратор ${cleanEmail} успешно создан/обновлен.`);
