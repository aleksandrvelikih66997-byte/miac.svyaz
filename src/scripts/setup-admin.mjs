
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '../firebase/config.mjs';

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error('Использование: node setup-admin.mjs <email> <password>');
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

console.log(`Создание администратора: ${email}...`);

createUserWithEmailAndPassword(auth, email, password)
  .then((userCredential) => {
    console.log('Успех: Администратор создан!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Ошибка создания:', error.message);
    process.exit(1);
  });
