
/**
 * @fileOverview Скрипт создания администратора в ЛОКАЛЬНОМ JSON-файле.
 * Не требует Firebase Auth API Key.
 * Использование: node src/scripts/setup-admin.mjs email password
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADMINS_DIR = path.join(__dirname, '../data');
const ADMINS_FILE = path.join(ADMINS_DIR, 'admins.json');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function setup() {
  const [email, password] = process.argv.slice(2);

  if (!email || !password) {
    console.error('❌ Укажите email и пароль: node setup-admin.mjs user@miac.ru password123');
    process.exit(1);
  }

  try {
    if (!fs.existsSync(ADMINS_DIR)) {
      fs.mkdirSync(ADMINS_DIR, { recursive: true });
    }

    let admins = [];
    if (fs.existsSync(ADMINS_FILE)) {
      admins = JSON.parse(fs.readFileSync(ADMINS_FILE, 'utf8'));
    }

    // Проверяем, существует ли уже такой пользователь
    const existingIndex = admins.findIndex(a => a.email === email);
    const newAdmin = {
      email,
      passwordHash: hashPassword(password),
      role: 'Admin',
      createdAt: new Date().toISOString()
    };

    if (existingIndex > -1) {
      admins[existingIndex] = newAdmin;
      console.log(`ℹ️ Пользователь ${email} обновлен.`);
    } else {
      admins.push(newAdmin);
      console.log(`✅ Пользователь ${email} создан.`);
    }

    fs.writeFileSync(ADMINS_FILE, JSON.stringify(admins, null, 2));
    console.log(`📁 Данные сохранены в ${ADMINS_FILE}`);

  } catch (error) {
    console.error('❌ Ошибка при создании:', error.message);
    process.exit(1);
  }
}

setup();
