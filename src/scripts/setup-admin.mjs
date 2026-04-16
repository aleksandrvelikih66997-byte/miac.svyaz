
/**
 * @fileOverview Скрипт создания локального администратора для системы МИАЦ.СВЯЗЬ.
 * Сохраняет данные в src/data/admins.json с хешированием пароля.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADMINS_FILE = path.join(__dirname, '..', 'data', 'admins.json');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function setup() {
  const [email, password] = process.argv.slice(2);

  if (!email || !password) {
    console.log('❌ Использование: node src/scripts/setup-admin.mjs <email> <password>');
    process.exit(1);
  }

  try {
    // Создаем директорию, если её нет
    const dataDir = path.dirname(ADMINS_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
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
    } else {
      admins.push(newAdmin);
    }

    fs.writeFileSync(ADMINS_FILE, JSON.stringify(admins, null, 2));
    console.log(`✅ Администратор ${email} успешно создан/обновлен локально.`);
  } catch (error) {
    console.error('❌ Ошибка при создании администратора:', error.message);
  }
}

setup();
