
/**
 * @fileOverview Мост между Firestore и локальным сервером Asterisk.
 * Автоматически генерирует pjsip_miac_users.conf и обновляет статусы абонентов.
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, query, updateDoc, doc } from 'firebase/firestore';
import { firebaseConfig } from '../firebase/config.mjs';
import fs from 'fs';
import path from 'path';
import asteriskManager from 'asterisk-manager';

// Настройка путей (для AltLinux SP)
const ASTERISK_CONF_PATH = '/etc/asterisk/pjsip_miac_users.conf';

// Инициализация Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Подключение к AMI (Asterisk Manager Interface)
const ami = new asteriskManager(5038, 'localhost', 'miac', 'MiacAMI2026', true);
ami.keepConnected();

console.log('🚀 Мост МИАЦ.СВЯЗЬ запущен...');

// 1. Синхронизация: Firestore -> Asterisk Config
const q = query(collection(db, "extensions"));
onSnapshot(q, (snapshot) => {
  let configContent = '; --- АВТОГЕНЕРАЦИЯ МИАЦ.СВЯЗЬ ---\n\n';
  
  snapshot.forEach((docSnap) => {
    const ext = docSnap.data();
    const id = docSnap.id;
    
    configContent += `[${id}](endpoint-internal)\n`;
    configContent += `auth=${id}-auth\n`;
    configContent += `aors=${id}\n\n`;
    
    configContent += `[${id}-auth](auth-internal)\n`;
    configContent += `username=${id}\n`;
    configContent += `password=${ext.secret}\n\n`;
    
    configContent += `[${id}](aor-internal)\n\n`;
  });

  try {
    // Внимание: на сервере нужны права на запись в /etc/asterisk/
    fs.writeFileSync(ASTERISK_CONF_PATH, configContent);
    console.log(`[${new Date().toLocaleTimeString()}] Конфигурация PJSIP обновлена.`);
    
    // Перезагрузка PJSIP в Asterisk
    ami.action({
      action: 'Command',
      command: 'pjsip reload'
    }, (err, res) => {
      if (err) console.error('Ошибка перезагрузки PJSIP:', err);
    });
  } catch (e) {
    console.error('❌ Ошибка записи конфига (проверьте права sudo):', e.message);
  }
});

// 2. Мониторинг статусов: Asterisk (AMI) -> Firestore
ami.on('peerstatus', (evt) => {
  const peer = evt.peer; // e.g. "PJSIP/101"
  const status = evt.peerstatus; // Registered/Unregistered
  
  if (peer.startsWith('PJSIP/')) {
    const extId = peer.split('/')[1];
    const online = status === 'Registered';
    
    console.log(`[AMI] Абонент ${extId} теперь ${status}`);
    
    updateDoc(doc(db, "extensions", extId), {
      status: online ? 'online' : 'offline',
      lastSeen: new Date().toISOString()
    }).catch(err => console.error('Ошибка обновления статуса в БД:', err.message));
  }
});
