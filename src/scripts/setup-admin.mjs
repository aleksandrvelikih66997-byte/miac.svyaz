
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADMINS_DIR = path.join(__dirname, '../data');
const ADMINS_FILE = path.join(ADMINS_DIR, 'admins.json');

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.log('❌ Использование: node setup-admin.mjs <email> <password>');
  process.exit(1);
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

try {
  if (!fs.existsSync(ADMINS_DIR)) {
    fs.mkdirSync(ADMINS_DIR, { recursive: true });
  }

  let admins = [];
  if (fs.existsSync(ADMINS_FILE)) {
    admins = JSON.parse(fs.readFileSync(ADMINS_FILE, 'utf8'));
  }

  const existingIndex = admins.findIndex(a => a.email === email);
  const newAdmin = {
    email,
    passwordHash: hashPassword(password),
    role: 'Admin',
    createdAt: new Date().toISOString()
  };

  if (existingIndex > -1) {
    admins[existingIndex] = newAdmin;
    console.log(`✅ Пароль для администратора ${email} обновлен.`);
  } else {
    admins.push(newAdmin);
    console.log(`✅ Администратор ${email} успешно создан локально.`);
  }

  fs.writeFileSync(ADMINS_FILE, JSON.stringify(admins, null, 2));
  console.log(`📁 Данные сохранены в: ${ADMINS_FILE}`);

} catch (error) {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
}
