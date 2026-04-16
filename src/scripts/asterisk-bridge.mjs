/**
 * @fileOverview МОСТ АВТОНОМНОЙ СИНХРОНИЗАЦИИ (МИАЦ.СВЯЗЬ)
 * Слушает изменения в локальных JSON файлах и обновляет Asterisk.
 * Работает полностью оффлайн.
 */

import fs from 'fs';
import path from 'path';
import asteriskManager from 'asterisk-manager';
import dotenv from 'dotenv';

dotenv.config();

const EXTENSIONS_FILE = path.resolve('src/data/extensions.json');
const TARGET_CONF = '/etc/asterisk/pjsip_miac_users.conf';

// Настройки AMI
const AMI_PORT = 5038;
const AMI_HOST = '127.0.0.1';
const AMI_USER = 'miac';
const AMI_PASS = 'MiacAMI2026';

const ami = new asteriskManager(AMI_PORT, AMI_HOST, AMI_USER, AMI_PASS, true);

ami.on('connect', () => console.log('🚀 [AMI] Подключено к Asterisk'));
ami.on('error', (err) => console.error('❌ [AMI] Ошибка подключения:', err.message));

function generatePJSIPConfig(extensions) {
  let config = `; АВТОГЕНЕРАЦИЯ МИАЦ.СВЯЗЬ - ${new Date().toLocaleString()}\n\n`;
  
  extensions.forEach(ext => {
    config += `[${ext.id}]\n`;
    config += `type=endpoint\n`;
    config += `context=${ext.context || 'from-internal'}\n`;
    config += `disallow=all\n`;
    config += `allow=ulaw,alaw\n`;
    config += `auth=${ext.id}-auth\n`;
    config += `aors=${ext.id}\n\n`;

    config += `[${ext.id}-auth]\n`;
    config += `type=auth\n`;
    config += `auth_type=userpass\n`;
    config += `password=${ext.secret}\n`;
    config += `username=${ext.id}\n\n`;

    config += `[${ext.id}]\n`;
    config += `type=aor\n`;
    config += `max_contacts=1\n\n`;
  });

  return config;
}

function sync() {
  if (!fs.existsSync(EXTENSIONS_FILE)) {
    console.log('ℹ️ [BRIDGE] Файл данных пуст или не найден.');
    return;
  }

  try {
    const data = JSON.parse(fs.readFileSync(EXTENSIONS_FILE, 'utf8'));
    const pjsipConfig = generatePJSIPConfig(data);

    fs.writeFileSync(TARGET_CONF, pjsipConfig);
    console.log(`✅ [BRIDGE] Обновлено: ${data.length} абонентов.`);

    // Перезагрузка PJSIP через AMI
    ami.action({
      action: 'Command',
      command: 'pjsip reload'
    }, (err, res) => {
      if (err) console.error('❌ [BRIDGE] Ошибка перезагрузки Asterisk:', err);
      else console.log('🔄 [BRIDGE] Asterisk PJSIP Reload: OK');
    });

  } catch (error) {
    console.error('❌ [BRIDGE] Ошибка синхронизации:', error.message);
  }
}

// Следим за изменениями в файле
console.log(`📂 [BRIDGE] Мост запущен. Слежение за: ${EXTENSIONS_FILE}`);
fs.watch(path.dirname(EXTENSIONS_FILE), (eventType, filename) => {
  if (filename === 'extensions.json') {
    console.log('📝 [BRIDGE] Обнаружены изменения в данных абонентов...');
    sync();
  }
});

// Первичная синхронизация при запуске
sync();
