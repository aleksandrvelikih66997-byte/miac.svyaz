
/**
 * @fileOverview Скрипт создания администратора панели управления.
 * Запускается из консоли сервера: node src/scripts/setup-admin.mjs email password
 */
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '../firebase/config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const [,, email, password] = process.argv;

if (!email || !password) {
  console.log('Использование: node src/scripts/setup-admin.mjs <email> <password>');
  process.exit(1);
}

console.log(`[SETUP] Попытка создания пользователя: ${email}...`);

createUserWithEmailAndPassword(auth, email, password)
  .then(() => {
    console.log(`[SUCCESS] Администратор ${email} успешно создан.`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(`[ERROR] Не удалось создать пользователя: ${error.message}`);
    process.exit(1);
  });
