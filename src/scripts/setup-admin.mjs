
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '../firebase/config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.log('Использование: node src/scripts/setup-admin.mjs <email> <password>');
  process.exit(1);
}

console.log(`[AUTH] Попытка создания администратора: ${email}...`);

createUserWithEmailAndPassword(auth, email, password)
  .then((userCredential) => {
    console.log('[AUTH] УСПЕХ: Пользователь создан и может войти в панель.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[AUTH] ОШИБКА:', error.message);
    process.exit(1);
  });
