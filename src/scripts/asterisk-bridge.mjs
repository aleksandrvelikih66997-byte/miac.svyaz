
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { firebaseConfig } from '../firebase/config.mjs';
import AsteriskManager from 'asterisk-manager';
import fs from 'fs';
import { exec } from 'child_process';

// Инициализация Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Настройки Asterisk
const AMI_USER = 'miac';
const AMI_SECRET = 'MiacAMI2026';
const CONFIG_PATH = '/etc/asterisk/pjsip_miac_users.conf';

const ami = new AsteriskManager(5038, 'localhost', AMI_USER, AMI_SECRET, true);

console.log('--- МИАЦ.СВЯЗЬ: Запуск моста синхронизации ---');

// 1. Синхронизация: WEB -> Asterisk (Генерация конфига)
onSnapshot(collection(db, 'extensions'), (snapshot) => {
  let configContent = '; Генерируемый файл МИАЦ.СВЯЗЬ. Не редактировать вручную.\n\n';
  
  snapshot.forEach((doc) => {
    const ext = doc.data();
    configContent += `[${ext.id}]\ntype=endpoint\ncontext=${ext.context || 'from-internal'}\ndisallow=all\nallow=ulaw,alaw\nauth=auth${ext.id}\naors=${ext.id}\ntransport=transport-udp\n\n`;
    configContent += `[auth${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
    configContent += `[${ext.id}]\ntype=aor\nmax_contacts=1\n\n`;
  });

  try {
    fs.writeFileSync(CONFIG_PATH, configContent);
    console.log(`[SYNC] Конфигурация обновлена: ${snapshot.size} абонентов.`);
    exec('asterisk -rx "core reload"', (err) => {
      if (err) console.error('[ERROR] Ошибка перезагрузки Asterisk:', err);
      else console.log('[SYNC] Asterisk перезагружен.');
    });
  } catch (err) {
    console.error('[ERROR] Ошибка записи файла:', err.message);
  }
});

// 2. Статусы: Asterisk -> WEB (AMI мониторинг)
ami.on('peerstatus', (evt) => {
  // Событие приходит в формате PJSIP/101
  const extId = evt.peer.split('/')[1];
  if (!extId) return;

  const status = evt.peerstatus.toLowerCase() === 'registered' ? 'online' : 'offline';
  
  updateDoc(doc(db, 'extensions', extId), { status })
    .then(() => console.log(`[STATUS] Абонент ${extId} теперь ${status}`))
    .catch(() => {}); // Игнорируем если абонента нет в базе
});

ami.on('managerevent', (evt) => {
  // Логирование важных событий в консоль для отладки
  if (evt.event === 'FullyBooted') console.log('[AMI] Подключение установлено.');
});

ami.keepConnected();
