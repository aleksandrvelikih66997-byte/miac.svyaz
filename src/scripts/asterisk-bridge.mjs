
/**
 * @fileOverview Скрипт синхронизации Firestore -> Asterisk .conf
 * Мониторит коллекцию 'extensions' и 'trunks' и перезаписывает файлы в /etc/asterisk/
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { firebaseConfig } from '../firebase/config.js';
import asteriskManager from 'asterisk-manager';
import fs from 'fs';
import path from 'path';

const PJSIP_FILE = '/etc/asterisk/pjsip_miac_users.conf';
const AMI_CONFIG = {
  port: 5038,
  host: '127.0.0.1',
  user: 'miac',
  password: 'MiacAMI2026'
};

// Инициализация Firebase (Client SDK для Node.js)
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Подключение к Asterisk AMI
const ami = new asteriskManager(AMI_CONFIG.port, AMI_CONFIG.host, AMI_CONFIG.user, AMI_CONFIG.password, true);

ami.on('managerevent', (evt) => {
  // Можно логировать события звонков здесь
});

function generatePjsipConfig(extensions, trunks) {
  let config = '; АВТОМАТИЧЕСКИ СГЕНЕРИРОВАНО МИАЦ.СВЯЗЬ\n';
  config += '; НЕ РЕДАКТИРУЙТЕ ВРУЧНУЮ\n\n';

  // Обработка абонентов
  extensions.forEach(ext => {
    config += `[${ext.id}]\n`;
    config += `type=endpoint\n`;
    config += `context=${ext.context || 'from-internal'}\n`;
    config += `disallow=all\n`;
    config += `allow=ulaw,alaw,g729\n`;
    config += `auth=auth${ext.id}\n`;
    config += `aors=${ext.id}\n`;
    config += `callerid=${ext.name} <${ext.id}>\n`;
    config += `device_state_busy_at=1\n\n`;

    config += `[auth${ext.id}]\n`;
    config += `type=auth\n`;
    config += `auth_type=userpass\n`;
    config += `username=${ext.id}\n`;
    config += `password=${ext.secret}\n\n`;

    config += `[${ext.id}]\n`;
    config += `type=aor\n`;
    config += `max_contacts=1\n\n`;
  });

  // Обработка транков (упрощенно)
  trunks.forEach(trunk => {
    config += `[trunk-${trunk.id}]\n`;
    config += `type=endpoint\n`;
    config += `context=from-external\n`;
    config += `disallow=all\n`;
    config += `allow=ulaw,alaw\n`;
    config += `outbound_auth=auth-trunk-${trunk.id}\n`;
    config += `aors=aor-trunk-${trunk.id}\n\n`;

    config += `[auth-trunk-${trunk.id}]\n`;
    config += `type=auth\n`;
    config += `auth_type=userpass\n`;
    config += `username=${trunk.user}\n`;
    config += `password=${trunk.password}\n\n`;

    config += `[aor-trunk-${trunk.id}]\n`;
    config += `type=aor\n`;
    config += `contact=sip:${trunk.host}:${trunk.port}\n\n`;
  });

  return config;
}

// Слушаем изменения в Firestore
let extensions = [];
let trunks = [];

function sync() {
  console.log('[BRIDGE] Синхронизация с Asterisk...');
  const config = generatePjsipConfig(extensions, trunks);
  
  try {
    fs.writeFileSync(PJSIP_FILE, config);
    console.log('[BRIDGE] Конфиг записан:', PJSIP_FILE);
    
    // Перезагрузка PJSIP в Asterisk
    ami.action({
      action: 'Command',
      command: 'pjsip reload'
    }, (err, res) => {
      if (err) console.error('[AMI ERROR]', err);
      else console.log('[BRIDGE] Asterisk PJSIP reloaded');
    });
  } catch (err) {
    console.error('[FS ERROR] Проверьте права на ' + PJSIP_FILE, err.message);
  }
}

onSnapshot(collection(db, 'extensions'), (snap) => {
  extensions = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  sync();
});

onSnapshot(collection(db, 'trunks'), (snap) => {
  trunks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  sync();
});

console.log('[BRIDGE] Мост запущен и ожидает изменений в Firestore...');
