
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '../firebase/config.js'; // Note: adjust path if needed or inline config

// Manual config inline to ensure it works in standalone script
const config = {
  apiKey: "api-key",
  authDomain: "project-id.firebaseapp.com",
  projectId: "project-id",
  storageBucket: "project-id.appspot.com",
  messagingSenderId: "sender-id",
  appId: "app-id"
};

const app = initializeApp(config);
const auth = getAuth(app);

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.log('Использование: node setup-admin.mjs <email> <password>');
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
