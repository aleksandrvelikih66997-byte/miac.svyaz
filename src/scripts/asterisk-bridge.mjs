
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot } from 'firebase/firestore';
import { firebaseConfig } from '../firebase/config.js';
import fs from 'fs';
import Ami from 'asterisk-manager';

/**
 * @fileOverview Скрипт синхронизации Firestore -> Asterisk (.conf).
 * Работает в фоновом режиме на сервере AltLinux.
 */

// Инициализация Firebase (Client SDK для Node.js)
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const CONF_FILE = '/etc/asterisk/pjsip_miac_users.conf';

// Подключение к AMI
// Убедитесь, что данные совпадают с /etc/asterisk/manager.conf
const ami = new Ami(5038, '127.0.0.1', 'miac', 'MiacAMI2026', true);
ami.keepConnected();

console.log('\x1b[32m%s\x1b[0m', '--- МИАЦ.СВЯЗЬ: МОСТ ЗАПУЩЕН ---');
console.log('Ожидание изменений в коллекции extensions...');

// Слушаем изменения в коллекции абонентов
onSnapshot(collection(db, 'extensions'), (snapshot) => {
  console.log(`[${new Date().toLocaleTimeString()}] Обнаружены изменения. Перегенерация конфига...`);
  
  let configContent = '; МИАЦ.СВЯЗЬ: АВТОГЕНЕРИРУЕМЫЙ КОНФИГУРАЦИОННЫЙ ФАЙЛ\n';
  configContent += '; НЕ РЕДАКТИРУЙТЕ ВРУЧНУЮ - ИЗМЕНЕНИЯ БУДУТ ПЕРЕЗАПИСАНЫ\n\n';
  
  snapshot.forEach((doc) => {
    const ext = doc.data();
    const id = doc.id;
    
    // Эндпоинт PJSIP
    configContent += `[${id}]\n`;
    configContent += `type=endpoint\n`;
    configContent += `context=${ext.context || 'from-internal'}\n`;
    configContent += `disallow=all\n`;
    configContent += `allow=ulaw,alaw\n`;
    configContent += `auth=${id}-auth\n`;
    configContent += `aors=${id}\n`;
    configContent += `max_contacts=${ext.maxCalls || 1}\n\n`;
    
    // Авторизация
    configContent += `[${id}-auth]\n`;
    configContent += `type=auth\n`;
    configContent += `auth_type=userpass\n`;
    configContent += `username=${id}\n`;
    configContent += `password=${ext.secret}\n\n`;
    
    // AOR
    configContent += `[${id}]\n`;
    configContent += `type=aor\n`;
    configContent += `max_contacts=${ext.maxCalls || 1}\n\n`;
  });
  
  try {
    // Записываем файл
    fs.writeFileSync(CONF_FILE, configContent);
    console.log(`[OK] Файл ${CONF_FILE} обновлен.`);
    
    // Отправляем команду на перезагрузку PJSIP в Asterisk
    ami.action({
      action: 'Command',
      command: 'pjsip reload'
    }, (err, res) => {
      if (err) {
        console.error('\x1b[31m%s\x1b[0m', '[ERROR] AMI не смог перезагрузить конфиг:', err.message);
      } else {
        console.log('\x1b[36m%s\x1b[0m', '[AMI] Asterisk PJSIP перезагружен успешно.');
      }
    });
    
  } catch (err) {
    console.error('\x1b[31m%s\x1b[0m', '[FATAL] Ошибка записи файла:', err.message);
    console.log('Проверьте права доступа: chmod 666 ' + CONF_FILE);
  }
});
