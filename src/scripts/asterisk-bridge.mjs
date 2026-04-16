
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { exec } from 'child_process';
import fs from 'fs';
import AmiClient from 'asterisk-manager';

// Конфигурация Firebase
const firebaseConfig = {
  apiKey: "api-key",
  authDomain: "project-id.firebaseapp.com",
  projectId: "project-id",
  storageBucket: "project-id.appspot.com",
  messagingSenderId: "sender-id",
  appId: "app-id"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Настройки Asterisk
const CONF_PATH = '/etc/asterisk/pjsip_miac_users.conf';
const AMI_PORT = 5038;
const AMI_USER = 'miac';
const AMI_PASS = 'MiacAMI2026';

// 1. Подключение к AMI для получения статусов
const ami = new AmiClient(AMI_PORT, 'localhost', AMI_USER, AMI_PASS, true);

ami.on('peerstatus', (evt) => {
  const extId = evt.peer.split('/')[1];
  const status = evt.peerstatus.toLowerCase() === 'registered' ? 'online' : 'offline';
  
  console.log(`[AMI] Статус абонента ${extId} изменился на: ${status}`);
  
  // Обновляем статус в Firestore
  const extRef = doc(db, 'extensions', extId);
  updateDoc(extRef, { status }).catch(err => console.error('Ошибка обновления статуса:', err.message));
});

ami.keepConnected();

// 2. Слушаем изменения в Firestore для записи конфигов
console.log('[BRIDGE] Запуск синхронизации...');

onSnapshot(collection(db, 'extensions'), (snapshot) => {
  let configContent = '; Генерируемый файл МИАЦ.СВЯЗЬ\n; НЕ РЕДАКТИРОВАТЬ ВРУЧНУЮ\n\n';
  
  snapshot.forEach((doc) => {
    const data = doc.data();
    if (data.tech === 'PJSIP') {
      configContent += `[${data.id}]\ntype=endpoint\ncontext=${data.context || 'from-internal'}\ndisallow=all\nallow=alaw,ulaw\nauth=${data.id}\naors=${data.id}\ntransport=transport-udp\n\n`;
      configContent += `[${data.id}]\ntype=auth\nauth_type=userpass\nusername=${data.id}\npassword=${data.secret}\n\n`;
      configContent += `[${data.id}]\ntype=aor\nmax_contacts=1\n\n`;
    }
  });

  fs.writeFileSync(CONF_PATH, configContent);
  console.log(`[BRIDGE] Файл ${CONF_PATH} обновлен.`);
  
  // Перезагрузка Asterisk
  exec('asterisk -rx "pjsip reload"', (error) => {
    if (error) console.error('[BRIDGE] Ошибка перезагрузки Asterisk:', error.message);
    else console.log('[BRIDGE] Asterisk: Конфигурация PJSIP перезагружена.');
  });
});
