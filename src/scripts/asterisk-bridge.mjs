
/**
 * @fileOverview Мост между Firestore и локальным Asterisk на AltLinux.
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot } from 'firebase/firestore';
import { firebaseConfig } from '../firebase/config.mjs';
import * as fs from 'fs';
import asteriskManager from 'asterisk-manager';

// Инициализация Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Конфигурация путей (для AltLinux SP 10)
const PJSIP_CONF_PATH = '/etc/asterisk/pjsip_miac_users.conf';

console.log('🚀 Мост МИАЦ.СВЯЗЬ запущен...');

// 1. Синхронизация: Firestore -> Asterisk .conf файлы
onSnapshot(collection(db, 'extensions'), (snapshot) => {
  let configContent = '; ГЕНЕРИРУЕМЫЙ ФАЙЛ. НЕ РЕДАКТИРОВАТЬ ВРУЧНУЮ.\n\n';
  
  snapshot.forEach((doc) => {
    const ext = doc.data();
    if (ext.tech === 'PJSIP') {
      configContent += `[${ext.id}]\ntype=endpoint\ncontext=${ext.context || 'from-internal'}\ndisallow=all\nallow=ulaw,alaw\nauth=${ext.id}-auth\naors=${ext.id}\n\n`;
      configContent += `[${ext.id}-auth]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
      configContent += `[${ext.id}]\ntype=aor\nmax_contacts=1\n\n`;
    }
  });

  try {
    fs.writeFileSync(PJSIP_CONF_PATH, configContent);
    console.log(`[${new Date().toLocaleTimeString()}] ✅ Обновлен ${PJSIP_CONF_PATH}`);
    // Команда Asterisk на перезагрузку (требует прав записи в сокет или sudo)
    // exec('asterisk -rx "pjsip reload"');
  } catch (e) {
    console.error('❌ Ошибка записи конфига. Проверьте права на /etc/asterisk/');
  }
});

// 2. Статусы: Asterisk (AMI) -> Firestore
// В реальной среде здесь должен быть коннект к AMI
console.log('📡 Ожидание подключений AMI для обновления статусов...');
