
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';

// Конфигурация из вашего проекта
const firebaseConfig = {
  apiKey: "api-key",
  authDomain: "project-id.firebaseapp.com",
  projectId: "project-id",
  storageBucket: "project-id.appspot.com",
  messagingSenderId: "sender-id",
  appId: "app-id"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const [,, email, password] = process.argv;

if (!email || !password) {
  console.log('Использование: node src/scripts/setup-admin.mjs <email> <password>');
  process.exit(1);
}

createUserWithEmailAndPassword(auth, email, password)
  .then((userCredential) => {
    console.log('Администратор успешно создан:', userCredential.user.email);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Ошибка создания администратора:', error.message);
    process.exit(1);
  });
