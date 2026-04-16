
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";

// Конфигурация Firebase должна совпадать с src/firebase/config.ts
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
  console.error("Использование: node setup-admin.mjs <email> <password>");
  process.exit(1);
}

console.log(`--- Создание администратора: ${email} ---`);

createUserWithEmailAndPassword(auth, email, password)
  .then((userCredential) => {
    console.log("Успех! Пользователь создан.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Ошибка при создании пользователя:", error.message);
    process.exit(1);
  });
