
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import asteriskManager from 'asterisk-manager';
import fs from 'fs';
import { exec } from 'child_process';
import { firebaseConfig } from '../firebase/config.js';

// Инициализация Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Конфигурация AMI
const ami = asteriskManager(5038, '127.0.0.1', 'miac', 'MiacAMI2026', true);

const PJSIP_CONF_PATH = '/etc/asterisk/pjsip_miac_users.conf';

console.log('[BRIDGE] Запуск моста МИАЦ.СВЯЗЬ...');

// 1. Слушаем изменения в Firestore (Абоненты)
onSnapshot(collection(db, 'extensions'), (snapshot) => {
  console.log('[BRIDGE] Обнаружены изменения абонентов в базе. Обновляем конфиг...');
  let config = '';
  
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    config += `
[${data.id}]
type=endpoint
context=${data.context || 'from-internal'}
disallow=all
allow=alaw,ulaw
auth=${data.id}
aors=${data.id}
transport=transport-udp

[${data.id}]
type=auth
auth_type=userpass
password=${data.secret}
username=${data.id}

[${data.id}]
type=aor
max_contacts=1
`;
  });

  try {
    fs.writeFileSync(PJSIP_CONF_PATH, config);
    console.log(`[BRIDGE] Файл ${PJSIP_CONF_PATH} успешно обновлен.`);
    
    // Перезагрузка Asterisk
    exec('asterisk -rx "pjsip reload"', (error) => {
      if (error) console.error('[BRIDGE] Ошибка при pjsip reload:', error);
      else console.log('[BRIDGE] Asterisk PJSIP конфигурация перезагружена.');
    });
  } catch (err) {
    console.error('[BRIDGE] КРИТИЧЕСКАЯ ОШИБКА записи файла:', err.message);
  }
});

// 2. Слушаем события AMI для обновления статусов в реальном времени
ami.on('peerstatus', (evt) => {
  const extId = evt.peer.replace('PJSIP/', '');
  const status = evt.peerstatus.toLowerCase() === 'registered' ? 'online' : 'offline';
  
  console.log(`[BRIDGE] Статус абонента ${extId} изменен на ${status}`);
  
  const extRef = doc(db, 'extensions', extId);
  updateDoc(extRef, { status }).catch(e => {
    // Тихо игнорируем если абонента нет в базе
  });
});

ami.on('managerevent', (evt) => {
  // Логирование всех событий для отладки если нужно
});
