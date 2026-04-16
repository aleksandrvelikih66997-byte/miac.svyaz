/**
 * @fileOverview МОСТ МИАЦ.СВЯЗЬ (Локальная версия)
 * Синхронизирует локальный JSON-файл с конфигурацией Asterisk PJSIP.
 */

import fs from 'fs';
import path from 'path';
import asteriskManager from 'asterisk-manager';
import dotenv from 'dotenv';

dotenv.config();

const USERS_FILE = '/etc/asterisk/pjsip_miac_users.conf';
const LOCAL_DATA = path.join(process.cwd(), 'src/data/extensions.json');

// Конфигурация AMI
const ami = asteriskManager(
  5038,
  '127.0.0.1',
  'miac',
  'MiacAMI2026',
  true
);

ami.keepConnected();

console.log('🚀 [BRIDGE] Мост МИАЦ.СВЯЗЬ запущен (Локальный режим)...');
console.log(`📂 [BRIDGE] Отслеживание: ${LOCAL_DATA}`);

function generatePjsipConfig(extensions) {
  let config = '; АВТОГЕНЕРАЦИЯ МИАЦ.СВЯЗЬ - НЕ РЕДАКТИРОВАТЬ ВРУЧНУЮ\n\n';
  
  extensions.forEach(ext => {
    config += `[${ext.id}]\ntype=endpoint\ncontext=from-internal\ndisallow=all\nallow=ulaw,alaw\nauth=${ext.id}\naors=${ext.id}\n\n`;
    config += `[${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
    config += `[${ext.id}]\ntype=aor\nmax_contacts=1\n\n`;
  });
  
  return config;
}

function sync() {
  if (!fs.existsSync(LOCAL_DATA)) {
    console.log('⚠️ [BRIDGE] Файл данных еще не создан.');
    return;
  }

  try {
    const extensions = JSON.parse(fs.readFileSync(LOCAL_DATA, 'utf8'));
    const config = generatePjsipConfig(extensions);
    
    fs.writeFileSync(USERS_FILE, config);
    console.log(`✅ [BRIDGE] Обновлено: ${extensions.length} абонентов.`);
    
    // Перезагрузка Asterisk через AMI
    ami.action({
      action: 'Command',
      command: 'pjsip reload'
    }, (err, res) => {
      if (err) console.error('❌ [BRIDGE] Ошибка AMI:', err);
      else console.log('🔄 [BRIDGE] Asterisk PJSIP Reload: OK');
    });
    
  } catch (err) {
    console.error('❌ [BRIDGE] Ошибка синхронизации:', err.message);
  }
}

// Следим за файлом
fs.watch(LOCAL_DATA, (eventType) => {
  if (eventType === 'change') {
    console.log('🔔 [BRIDGE] Обнаружены изменения в данных...');
    sync();
  }
});

// Первичная синхронизация
sync();
