
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import fs from 'fs';
import { exec } from 'child_process';
import ami from 'asterisk-manager';

// Firebase Config
const config = {
  apiKey: "api-key",
  authDomain: "project-id.firebaseapp.com",
  projectId: "project-id",
  storageBucket: "project-id.appspot.com",
  messagingSenderId: "sender-id",
  appId: "app-id"
};

const app = initializeApp(config);
const db = getFirestore(app);

// Asterisk AMI Config
const amiPort = 5038;
const amiHost = 'localhost';
const amiUser = 'miac';
const amiPassword = 'MiacAMI2026';

const pjsipConfPath = '/etc/asterisk/pjsip_miac_users.conf';

console.log('=== [BRIDGE] Запуск моста МИАЦ.СВЯЗЬ ===');

// 1. Listen for Firestore changes and update pjsip.conf
onSnapshot(collection(db, 'extensions'), (snapshot) => {
  console.log('[FIRESTORE] Обнаружены изменения абонентов...');
  
  let configContent = '; Генерируемый файл. Не редактировать вручную.\n\n';
  
  snapshot.forEach((extDoc) => {
    const ext = extDoc.data();
    configContent += `[${ext.id}]\n`;
    configContent += `type=endpoint\n`;
    configContent += `context=${ext.context || 'from-internal'}\n`;
    configContent += `disallow=all\n`;
    configContent += `allow=ulaw,alaw\n`;
    configContent += `auth=auth${ext.id}\n`;
    configContent += `aors=${ext.id}\n`;
    configContent += `transport=transport-udp\n\n`;

    configContent += `[auth${ext.id}]\n`;
    configContent += `type=auth\n`;
    configContent += `auth_type=userpass\n`;
    configContent += `password=${ext.secret}\n`;
    configContent += `username=${ext.id}\n\n`;

    configContent += `[${ext.id}]\n`;
    configContent += `type=aor\n`;
    configContent += `max_contacts=1\n\n`;
  });

  try {
    fs.writeFileSync(pjsipConfPath, configContent);
    console.log(`[ASTERISK] Файл ${pjsipConfPath} обновлен.`);
    
    exec('asterisk -rx "pjsip reload"', (err) => {
      if (err) console.error('[ERROR] Ошибка перезагрузки Asterisk:', err.message);
      else console.log('[ASTERISK] Конфигурация PJSIP перезагружена.');
    });
  } catch (e) {
    console.error('[ERROR] Ошибка записи файла. Проверьте права (sudo):', e.message);
  }
});

// 2. Connect to AMI for real-time status updates
const manager = new ami(amiPort, amiHost, amiUser, amiPassword, true);

manager.on('peerstatus', (evt) => {
  const peer = evt.peer.split('/')[1] || evt.peer;
  const status = evt.peerstatus.toLowerCase() === 'registered' ? 'online' : 'offline';
  
  console.log(`[AMI] Статус абонента ${peer}: ${status}`);
  
  // Update Firestore status
  const extRef = doc(db, 'extensions', peer);
  updateDoc(extRef, { status }).catch(() => {
    // Silent catch if document doesn't exist
  });
});

manager.on('error', (err) => {
  console.error('[AMI] Ошибка подключения:', err);
});

console.log('[AMI] Ожидание событий регистрации...');
