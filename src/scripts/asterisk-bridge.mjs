
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import amigen from 'asterisk-manager';
import fs from 'fs';
import { exec } from 'child_process';

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

// Настройки AMI (из вашего контекста)
const ami = new amigen(5038, 'localhost', 'miac', 'MiacAMI2026', true);

ami.keepconnected();

console.log('--- МИАЦ.СВЯЗЬ: МОСТ ЗАПУЩЕН ---');

// 1. СЛУШАЕМ ИЗМЕНЕНИЯ В FIRESTORE И ОБНОВЛЯЕМ КОНФИГИ
onSnapshot(collection(db, 'extensions'), (snapshot) => {
  let config = '; АВТОГЕНЕРАЦИЯ МИАЦ.СВЯЗЬ\n\n';
  
  snapshot.forEach((doc) => {
    const ext = doc.data();
    config += `[${ext.id}]\ntype=endpoint\ncontext=${ext.context || 'from-internal'}\ndirect_media=no\nauth=${ext.id}\noutbound_auth=${ext.id}\naors=${ext.id}\ntransport=transport-udp\n\n`;
    config += `[${ext.id}]\ntype=auth\nauth_type=userpass\npassword=${ext.secret}\nusername=${ext.id}\n\n`;
    config += `[${ext.id}]\ntype=aor\nmax_contacts=1\n\n`;
  });

  fs.writeFileSync('/etc/asterisk/pjsip_miac_users.conf', config);
  console.log('[BRIDGE] Файл pjsip_miac_users.conf обновлен');
  
  exec('asterisk -rx "core reload"', (err) => {
    if (!err) console.log('[BRIDGE] Конфигурация Asterisk перезагружена');
  });
});

// 2. СЛУШАЕМ СОБЫТИЯ ASTERISK И ОБНОВЛЯЕМ СТАТУСЫ В FIRESTORE
ami.on('peerstatus', (evt) => {
  const endpoint = evt.peer.replace('PJSIP/', '');
  const status = evt.peerstatus.toLowerCase() === 'registered' ? 'online' : 'offline';
  
  console.log(`[AMI] Абонент ${endpoint} теперь ${status}`);
  
  updateDoc(doc(db, 'extensions', endpoint), { status })
    .catch(e => console.error('[BRIDGE] Ошибка обновления статуса:', e.message));
});

ami.on('managerevent', (evt) => {
  // Логирование событий для отладки
  if (evt.event === 'FullyBooted') console.log('[AMI] Соединение установлено');
});
