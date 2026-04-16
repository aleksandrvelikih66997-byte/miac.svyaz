
/**
 * @fileOverview Скрипт для создания первого администратора системы через консоль сервера.
 * Использование: node src/scripts/setup-admin.mjs <email> <password>
 */

import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '../firebase/config.js'; // Убедитесь, что расширение .js поддерживается или переименуйте config в .js/mjs

async function setup() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('\x1b[31m%s\x1b[0m', 'Ошибка: Укажите email и пароль.');
    console.log('Использование: node src/scripts/setup-admin.mjs admin@example.com myPassword123');
    process.exit(1);
  }

  const [email, password] = args;

  // Инициализируем клиентский SDK в Node среде для регистрации
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);

  console.log(`Создание пользователя: ${email}...`);

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log('\x1b[32m%s\x1b[0m', '✅ Пользователь успешно создан!');
    console.log('UID:', userCredential.user.uid);
    process.exit(0);
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ Ошибка при создании пользователя:');
    console.error(error.message);
    process.exit(1);
  }
}

setup();
