
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADMINS_FILE = path.join(__dirname, '../data/admins.json');

// Функция для хеширования пароля
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function setupAdmin() {
  const args = process.argv.slice(2);
  const email = args[0];
  const password = args[1];

  if (!email || !password) {
    console.log('❌ Использование: node src/scripts/setup-admin.mjs <email> <password>');
    process.exit(1);
  }

  try {
    // Гарантируем наличие папки data
    const dataDir = path.dirname(ADMINS_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    let admins = [];
    if (fs.existsSync(ADMINS_FILE)) {
      admins = JSON.parse(fs.readFileSync(ADMINS_FILE, 'utf8'));
    }

    // Добавляем или обновляем админа
    const newAdmin = {
      email,
      passwordHash: hashPassword(password),
      role: 'admin',
      createdAt: new Date().toISOString()
    };

    const index = admins.findIndex(a => a.email === email);
    if (index !== -1) {
      admins[index] = newAdmin;
      console.log(`✅ Пароль администратора ${email} обновлен локально.`);
    } else {
      admins.push(newAdmin);
      console.log(`✅ Администратор ${email} создан локально.`);
    }

    fs.writeFileSync(ADMINS_FILE, JSON.stringify(admins, null, 2));
    console.log(`📁 Данные сохранены в ${ADMINS_FILE}`);
  } catch (error) {
    console.error('❌ Ошибка при создании администратора:', error.message);
  }
}

setupAdmin();
