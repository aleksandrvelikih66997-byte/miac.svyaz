
/**
 * @fileOverview Скрипт для создания первого администратора через консоль.
 * Запуск: node src/scripts/setup-admin.mjs email@domain.ru password123
 */
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';

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

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error("ОШИБКА: Укажите email и пароль. Пример:");
  console.error("node src/scripts/setup-admin.mjs admin@miac.ru myPassword123");
  process.exit(1);
}

createUserWithEmailAndPassword(auth, email, password)
  .then((userCredential) => {
    console.log("УСПЕХ: Администратор создан!");
    console.log("ID:", userCredential.user.uid);
    console.log("Email:", email);
    process.exit(0);
  })
  .catch((error) => {
    console.error("ОШИБКА:", error.message);
    process.exit(1);
  });
