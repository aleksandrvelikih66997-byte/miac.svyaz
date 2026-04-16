
/**
 * @fileOverview Мост между Firestore и Asterisk (PJSIP + AMI).
 * Автоматически обновляет конфиги и транслирует статусы.
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { firebaseConfig } from '../firebase/config.mjs';
import asteriskManager from 'asterisk-manager';
import fs from 'fs';
import { exec } from 'child_process';

// Путь к конфигурационному файлу абонентов
const PJSIP_CONFIG_PATH = '/etc/asterisk/pjsip_miac_users.conf';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log('--- МИАЦ.СВЯЗЬ: BRIDGE СТАРТ ---');

// 1. Инициализация AMI
const ami = new asteriskManager(5038, 'localhost', 'miac', 'MiacAMI2026', true);

ami.on('managerevent', (evt) => {
  if (evt.event === 'PeerStatus') {
    const peer = evt.peer.replace('PJSIP/', '');
    const status = evt.peerstatus.toLowerCase() === 'registered' ? 'online' : 'offline';
    console.log(`[AMI] Статус абонента ${peer}: ${status}`);
    
    // Обновляем статус в Firestore
    const extRef = doc(db, 'extensions', peer);
    updateDoc(extRef, { status }).catch(() => {});
  }
});

// 2. Синхронизация Конфигов (Firestore -> Asterisk)
onSnapshot(collection(db, 'extensions'), (snapshot) => {
  let configContent = '; --- Генерируется автоматически МИАЦ.СВЯЗЬ ---\n\n';
  
  snapshot.forEach((doc) => {
    const ext = doc.data();
    if (ext.tech === 'PJSIP') {
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
    }
  });

  try {
    fs.writeFileSync(PJSIP_CONFIG_PATH, configContent);
    console.log(`[FS] Конфигурация обновлена: ${PJSIP_CONFIG_PATH}`);
    
    // Применяем настройки в Asterisk
    exec('asterisk -rx "pjsip reload"', (err) => {
      if (!err) console.log('[ASTERISK] PJSIP Reload OK');
    });
  } catch (e) {
    console.error(`[ERROR] Не удалось записать файл: ${e.message}`);
    console.log('СОВЕТ: Проверьте права доступа: chown -R asterisk:asterisk /etc/asterisk');
  }
});
