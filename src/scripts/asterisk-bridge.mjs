
/**
 * @fileOverview Скрипт-мостик (Bridge) для синхронизации Firestore и Asterisk.
 * Должен быть запущен на сервере: npm run bridge
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import asteriskManager from 'asterisk-manager';
import fs from 'fs';
import path from 'path';

// Конфигурация Firebase (такая же как в приложении)
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

// Конфигурация AMI
const ami = asteriskManager(5038, '127.0.0.1', 'miac', 'MiacAMI2026', true);

const PJSIP_FILE_PATH = '/etc/asterisk/pjsip_miac_users.conf';

console.log('🚀 Мостик МИАЦ.СВЯЗЬ запущен...');

// 1. Слушаем изменения в Firestore и обновляем конфиги Asterisk
onSnapshot(collection(db, 'extensions'), (snapshot) => {
  console.log('📝 Изменения в базе обнаружены. Генерирую конфиг...');
  
  let content = '; --- АВТОМАТИЧЕСКАЯ ГЕНЕРАЦИЯ МИАЦ ---\n';
  snapshot.forEach((doc) => {
    const ext = doc.data();
    content += `
[${ext.id}]
type=endpoint
context=${ext.context || 'from-internal'}
disallow=all
allow=alaw,ulaw
auth=${ext.id}_auth
aors=${ext.id}
transport=transport-udp

[${ext.id}_auth]
type=auth
auth_type=userpass
username=${ext.id}
password=${ext.secret || 'MiacPass2024'}

[${ext.id}]
type=aor
max_contacts=1
`;
  });

  try {
    fs.writeFileSync(PJSIP_FILE_PATH, content);
    console.log('✅ Файл pjsip_miac_users.conf обновлен.');
    
    // Перезагружаем Asterisk через AMI
    ami.action({
      action: 'Command',
      command: 'core reload'
    }, (err, res) => {
      if (err) console.error('❌ Ошибка перезагрузки:', err);
      else console.log('🔄 Asterisk успешно перезагружен.');
    });
  } catch (err) {
    console.error('❌ Ошибка записи файла:', err.message);
  }
});

// 2. Слушаем события AMI и обновляем статусы в Firestore
ami.on('peerstatus', (evt) => {
  // Событие: Registered, Unregistered, Reachable, Lagged
  const peerId = evt.peer.replace('PJSIP/', '');
  let status = 'offline';
  
  if (evt.peerstatus === 'Reachable' || evt.peerstatus === 'Registered') {
    status = 'online';
  }

  console.log(`📱 Статус абонента ${peerId} изменен на ${status}`);
  
  // Обновляем Firestore
  updateDoc(doc(db, 'extensions', peerId), { status })
    .catch(err => console.error('❌ Ошибка обновления статуса в DB:', err.message));
});

// 3. Обработка DND (через DeviceStateChange или Custom события)
ami.on('extensionstatus', (evt) => {
  // Логика обновления DND в Firestore при изменении в Asterisk
});

ami.on('error', (err) => {
  console.error('❌ Ошибка AMI:', err);
});
