
import fs from 'fs';
import path from 'path';
import asteriskManager from 'asterisk-manager';

/**
 * АСТЕРИСК МОСТ (Asterisk Bridge)
 * Синхронизирует локальные JSON-файлы с конфигурацией Asterisk PJSIP.
 */

const DATA_DIR = path.join(process.cwd(), 'src/data');
const EXTENSIONS_FILE = path.join(DATA_DIR, 'extensions.json');
const PJSIP_CONF_PATH = '/etc/asterisk/pjsip_miac_users.conf';

// Настройки AMI (из вашего manager.conf)
const ami = new asteriskManager(
  '5038',
  '127.0.0.1',
  'miac',
  'MiacAMI2026',
  true
);

ami.keepConnected();

function generatePjsipConfig(extensions) {
  let config = `; --- МИАЦ.СВЯЗЬ: АВТОГЕНЕРАЦИЯ ---\n`;
  config += `; Дата обновления: ${new Date().toLocaleString()}\n\n`;

  // 1. Определение транспорта (критично для Asterisk 17)
  config += `[transport-udp]\n`;
  config += `type=transport\n`;
  config += `protocol=udp\n`;
  config += `bind=0.0.0.0:5060\n\n`;

  extensions.forEach(ext => {
    const id = ext.id;
    const secret = ext.secret || 'password';
    const context = ext.context || 'from-internal';
    const name = ext.name || 'User';

    // AOR (Address of Record)
    config += `[${id}](!)\n`;
    config += `type=aor\n`;
    config += `max_contacts=1\n`;
    config += `remove_existing=yes\n\n`;

    // AUTH
    config += `[${id}](!)\n`;
    config += `type=auth\n`;
    config += `auth_type=userpass\n`;
    config += `username=${id}\n`;
    config += `password=${secret}\n\n`;

    // ENDPOINT
    config += `[${id}]\n`;
    config += `type=endpoint\n`;
    config += `context=${context}\n`;
    config += `disallow=all\n`;
    config += `allow=ulaw,alaw,g722\n`;
    config += `auth=${id}\n`;
    config += `outbound_auth=${id}\n`;
    config += `aors=${id}\n`;
    config += `callerid=${name} <${id}>\n`;
    config += `transport=transport-udp\n`;
    config += `direct_media=no\n`;
    config += `rewrite_contact=yes\n`;
    config += `force_rport=yes\n`;
    config += `rtp_symmetric=yes\n\n`;
  });

  return config;
}

async function sync() {
  console.log(`\n🔄 [BRIDGE] Начало синхронизации...`);
  
  if (!fs.existsSync(EXTENSIONS_FILE)) {
    console.log(`⚠️ [BRIDGE] Файл абонентов не найден.`);
    return;
  }

  try {
    const extensions = JSON.parse(fs.readFileSync(EXTENSIONS_FILE, 'utf8'));
    const configContent = generatePjsipConfig(extensions);

    // Записываем конфиг
    fs.writeFileSync(PJSIP_CONF_PATH, configContent);
    console.log(`✅ [BRIDGE] Файл ${PJSIP_CONF_PATH} обновлен. Абонентов: ${extensions.length}`);

    // Команда перезагрузки через AMI
    // В Asterisk 17 самая надежная команда - reload модуля напрямую
    ami.action({
      action: 'Command',
      command: 'module reload res_pjsip.so'
    }, (err, res) => {
      if (err) {
        console.error(`❌ [BRIDGE] AMI Error:`, err);
      } else {
        console.log(`🔄 [BRIDGE] Asterisk PJSIP Reload: OK`);
      }
    });

  } catch (error) {
    console.error(`❌ [BRIDGE] Ошибка:`, error.message);
  }
}

// Следим за изменениями в JSON файле
console.log(`🚀 [BRIDGE] Мост МИАЦ.СВЯЗЬ запущен...`);
console.log(`📂 [BRIDGE] Директория данных: ${DATA_DIR}`);

fs.watch(DATA_DIR, (eventType, filename) => {
  if (filename === 'extensions.json') {
    sync();
  }
});

// Первый запуск при старте
sync();
