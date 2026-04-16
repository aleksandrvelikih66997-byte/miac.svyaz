
/**
 * @fileOverview Мост синхронизации локальной базы данных с Asterisk PJSIP.
 * Оптимизировано для Asterisk 17/20 в изолированном контуре.
 */

import fs from 'fs';
import path from 'path';
import asteriskManager from 'asterisk-manager';

const DATA_DIR = path.join(process.cwd(), 'src/data');
const EXTENSIONS_FILE = path.join(DATA_DIR, 'extensions.json');
const TARGET_CONF = '/etc/asterisk/pjsip_miac_users.conf';

// Настройки AMI (должны совпадать с /etc/asterisk/manager.conf)
const amiConfig = {
  port: 5038,
  host: '127.0.0.1',
  user: 'miac',
  password: 'MiacAMI2026'
};

const ami = asteriskManager(amiConfig.port, amiConfig.host, amiConfig.user, amiConfig.password, true);

console.log('🚀 [BRIDGE] Мост МИАЦ.СВЯЗЬ запущен...');
console.log(`📂 [BRIDGE] Директория данных: ${DATA_DIR}`);

// Функция генерации конфига PJSIP
function generatePjsipConfig(extensions) {
  let config = '; ГЕНЕРИРУЕМЫЙ ФАЙЛ. НЕ РЕДАКТИРОВАТЬ ВРУЧНУЮ.\n\n';

  extensions.forEach(ext => {
    config += `;;; Абонент ${ext.id} (${ext.name})\n`;
    
    // Блок Endpoint
    config += `[${ext.id}]\n`;
    config += `type=endpoint\n`;
    config += `context=from-internal\n`;
    config += `disallow=all\n`;
    config += `allow=ulaw,alaw,g722\n`;
    config += `auth=${ext.id}\n`;
    config += `outbound_auth=${ext.id}\n`;
    config += `aors=${ext.id}\n`;
    config += `direct_media=no\n`;
    config += `rewrite_contact=yes\n`;
    config += `force_rport=yes\n\n`;

    // Блок Auth
    config += `[${ext.id}]\n`;
    config += `type=auth\n`;
    config += `auth_type=userpass\n`;
    config += `username=${ext.id}\n`;
    config += `password=${ext.secret}\n\n`;

    // Блок AOR
    config += `[${ext.id}]\n`;
    config += `type=aor\n`;
    config += `max_contacts=5\n`;
    config += `remove_existing=yes\n\n`;
  });

  return config;
}

// Функция отправки команды перезагрузки через AMI
async function reloadAsteriskPjsip() {
  // Список команд для пробы (в порядке приоритета для v17)
  const commands = [
    'module reload res_pjsip.so',
    'pjsip reload',
    'core reload'
  ];

  for (const cmd of commands) {
    try {
      const result = await new Promise((resolve, reject) => {
        ami.action({
          action: 'Command',
          command: cmd
        }, (err, res) => {
          if (err) reject(err);
          else resolve(res);
        });
      });

      if (result.response === 'Success' || (result.output && !result.output.includes('No such command'))) {
        console.log(`✅ [BRIDGE] Asterisk Command (${cmd}): OK`);
        return true;
      }
    } catch (e) {
      // Продолжаем пробовать следующую команду
    }
  }
  
  console.error('❌ [BRIDGE] Все попытки перезагрузки провалились. Проверьте права AMI.');
  return false;
}

// Основной цикл синхронизации
async function sync() {
  try {
    if (!fs.existsSync(EXTENSIONS_FILE)) {
      console.log('ℹ️ [BRIDGE] Файл данных пуст. Ожидание абонентов...');
      return;
    }

    const extensions = JSON.parse(fs.readFileSync(EXTENSIONS_FILE, 'utf8'));
    const config = generatePjsipConfig(extensions);

    // Записываем файл (нужны права 666 на /etc/asterisk/pjsip_miac_users.conf)
    fs.writeFileSync(TARGET_CONF, config);
    console.log(`✅ [BRIDGE] Файл ${TARGET_CONF} обновлен. Абонентов: ${extensions.length}`);

    // Даем команду Asterisk
    await reloadAsteriskPjsip();
  } catch (error) {
    console.error('❌ [BRIDGE] Ошибка синхронизации:', error.message);
  }
}

// Следим за изменениями в JSON файле
fs.watch(DATA_DIR, (eventType, filename) => {
  if (filename === 'extensions.json') {
    console.log('🔄 [BRIDGE] Обнаружены изменения в абонентах...');
    sync();
  }
});

// Первичный запуск
sync();

// Обработка ошибок AMI
ami.on('error', (err) => {
  console.error('❌ [BRIDGE] AMI Connection Error:', err.message);
});

ami.on('rawevent', (evt) => {
  // Можно добавить логирование событий Asterisk здесь
});
