
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '../firebase/config.mjs';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const [,, email, password] = process.argv;

if (!email || !password) {
  console.log('Использование: node src/scripts/setup-admin.mjs <email> <password>');
  process.exit(1);
}

createUserWithEmailAndPassword(auth, email, password)
  .then((userCredential) => {
    console.log('✅ Администратор успешно создан:', userCredential.user.email);
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка при создании:', error.message);
    process.exit(1);
  });
