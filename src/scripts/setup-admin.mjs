import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * @fileOverview Скрипт создания администратора панели МИАЦ.СВЯЗЬ.
 * Использование: node src/scripts/setup-admin.mjs email password
 */

const ADMINS_FILE = path.join(process.cwd(), 'src/data/admins.json');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Использование: node src/scripts/setup-admin.mjs <email> <password>');
    process.exit(1);
  }

  const [email, password] = args;

  try {
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
      console.log(`✅ Пользователь ${email} обновлен.`);
    } else {
      admins.push(newAdmin);
      console.log(`✅ Пользователь ${email} успешно создан.`);
    }

    fs.writeFileSync(ADMINS_FILE, JSON.stringify(admins, null, 2));
    console.log('Данные сохранены в src/data/admins.json');
    
  } catch (error) {
    console.error('❌ Ошибка при создании:', error.message);
  }
}

main();
