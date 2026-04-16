
/**
 * @fileOverview Скрипт для создания администратора панели управления через консоль.
 * Запуск: node src/scripts/setup-admin.mjs email password
 */
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '../firebase/config.mjs';

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error('Ошибка: Укажите email и пароль. Пример: node setup-admin.mjs admin@miac.ru myPass123');
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

console.log(`Попытка создания администратора: ${email}...`);

createUserWithEmailAndPassword(auth, email, password)
  .then((userCredential) => {
    console.log('--- УСПЕХ ---');
    console.log(`Администратор ${email} успешно создан.`);
    console.log('Теперь вы можете войти в веб-панель.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('--- ОШИБКА ---');
    if (error.code === 'auth/email-already-in-use') {
      console.error('Пользователь с таким email уже существует.');
    } else {
      console.error(error.message);
    }
    process.exit(1);
  });
