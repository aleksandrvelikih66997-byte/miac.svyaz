
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, query } from 'firebase/firestore';
import { firebaseConfig } from '../firebase/config.js';
import fs from 'fs';
import path from 'path';
import ami from 'asterisk-manager';

/**
 * АСТЕРИСК МОСТ (BRIDGE)
 * Этот скрипт синхронизирует Firestore с локальными файлами Asterisk.
 * Запускать: node src/scripts/asterisk-bridge.mjs
 */

const PJSIP_FILE = '/etc/asterisk/pjsip_miac_users.conf';
const AMI_PORT = 5038;
const AMI_USER = 'miac';
const AMI_PASS = 'MiacAMI2026';

console.log('🚀 Запуск моста МИАЦ.СВЯЗЬ...');

// Инициализация Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Подключение к AMI для управления статусами и перезагрузки
const manager = new ami(AMI_PORT, '127.0.0.1', AMI_USER, AMI_PASS, true);

manager.on('connect', () => console.log('✅ AMI: Подключено'));
manager.on('error', (err) => console.error('❌ AMI Error:', err));

// Подписка на изменения абонентов (Extensions)
const q = query(collection(db, 'extensions'));

onSnapshot(q, (snapshot) => {
  console.log(`📦 Синхронизация: ${snapshot.size} абонентов`);
  
  let configContent = '; ГЕНЕРИРУЕМЫЙ ФАЙЛ. НЕ РЕДАКТИРОВАТЬ ВРУЧНУЮ.\n\n';
  
  snapshot.forEach((doc) => {
    const ext = doc.data();
    const id = doc.id;
    
    configContent += `[${id}]\n`;
    configContent += `type=endpoint\n`;
    configContent += `context=${ext.context || 'from-internal'}\n`;
    configContent += `disallow=all\n`;
    configContent += `allow=ulaw,alaw\n`;
    configContent += `auth=auth${id}\n`;
    configContent += `aors=${id}\n\n`;
    
    configContent += `[auth${id}]\n`;
    configContent += `type=auth\n`;
    configContent += `auth_type=userpass\n`;
    configContent += `username=${id}\n`;
    configContent += `password=${ext.secret}\n\n`;
    
    configContent += `[${id}]\n`;
    configContent += `type=aor\n`;
    configContent += `max_contacts=1\n\n`;
  });

  try {
    fs.writeFileSync(PJSIP_FILE, configContent);
    console.log('💾 Файл pjsip_miac_users.conf обновлен');
    
    // Перезагрузка PJSIP в Asterisk
    manager.action({
      action: 'Command',
      command: 'pjsip reload'
    }, (err, res) => {
      if (err) console.error('❌ Reload Error:', err);
      else console.log('🔄 Asterisk: PJSIP reloaded');
    });
  } catch (err) {
    console.error('❌ Ошибка записи файла:', err.message);
  }
});
