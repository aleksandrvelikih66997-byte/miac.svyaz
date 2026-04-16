
/**
 * @fileOverview Скрипт создания администратора панели управления через консоль.
 */
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '../firebase/config.mjs';

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.log('❌ Использование: node src/scripts/setup-admin.mjs <email> <password>');
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

console.log(`⏳ Попытка создания администратора: ${email}...`);

createUserWithEmailAndPassword(auth, email, password)
  .then((userCredential) => {
    console.log('✅ Успех! Администратор создан.');
    console.log('ID пользователя:', userCredential.user.uid);
    process.exit(0);
  })
  .catch((error) => {
    if (error.code === 'auth/email-already-in-use') {
      console.log('ℹ️ Пользователь уже существует.');
      process.exit(0);
    }
    console.error('❌ Ошибка при создании:', error.message);
    process.exit(1);
  });
