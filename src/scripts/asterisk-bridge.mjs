import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot } from 'firebase/firestore';
import { firebaseConfig } from '../firebase/config.mjs';
import fs from 'fs';
import { exec } from 'child_process';

/**
 * @fileOverview Серверный мост (Bridge) для синхронизации настроек из веба в Asterisk 20.
 */

const CONF_FILE = '/etc/asterisk/pjsip_miac_users.conf';

// Инициализация
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log('🚀 [BRIDGE] Мост МИАЦ.СВЯЗЬ запущен...');
console.log(`📂 [BRIDGE] Целевой файл: ${CONF_FILE}`);

// Слушаем изменения в коллекции extensions
onSnapshot(collection(db, 'extensions'), (snapshot) => {
  let configContent = '; ГЕНЕРИРУЕМЫЙ ФАЙЛ МИАЦ.СВЯЗЬ\n; НЕ РЕДАКТИРОВАТЬ ВРУЧНУЮ\n\n';

  snapshot.forEach((doc) => {
    const ext = doc.data();
    configContent += `[${ext.id}]\ntype=endpoint\ncontext=${ext.context || 'from-internal'}\ndisallow=all\nallow=ulaw,alaw\nauth=auth${ext.id}\naors=${ext.id}\n\n`;
    configContent += `[auth${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
    configContent += `[${ext.id}]\ntype=aor\nmax_contacts=1\n\n`;
  });

  try {
    // ВНИМАНИЕ: На сервере AltLinux убедитесь, что у пользователя Node.js есть права на запись в /etc/asterisk
    fs.writeFileSync(CONF_FILE, configContent);
    console.log(`✅ [BRIDGE] Обновлено: ${snapshot.size} абонентов.`);
    
    // Перезагрузка Asterisk
    exec('asterisk -rx "pjsip reload"', (error, stdout, stderr) => {
      if (error) console.error(`❌ [BRIDGE] Ошибка перезагрузки: ${error.message}`);
      else console.log('🔄 [BRIDGE] Asterisk PJSIP Reload: OK');
    });
  } catch (err) {
    console.error('❌ [BRIDGE] Ошибка записи файла:', err.message);
  }
});
