
/**
 * @fileOverview Мост МИАЦ.СВЯЗЬ (МИАЦ.АТС)
 * Синхронизирует локальные JSON-файлы с конфигурацией Asterisk PJSIP.
 * Оптимизировано для Asterisk 17/20 на AltLinux SP.
 */

import fs from 'fs';
import path from 'path';
import asteriskManager from 'asterisk-manager';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '../../');
const DATA_DIR = path.join(PROJECT_ROOT, 'src/data');
const PJSIP_FILE = '/etc/asterisk/pjsip_miac_users.conf';

// Конфигурация AMI (должна совпадать с manager.conf)
const amiConfig = {
  port: 5038,
  host: '127.0.0.1',
  user: 'miac',
  secret: 'MiacAMI2026'
};

const ami = new asteriskManager(
  amiConfig.port,
  amiConfig.host,
  amiConfig.user,
  amiConfig.secret,
  true // Reconnect
);

console.log('🚀 [BRIDGE] Мост МИАЦ.СВЯЗЬ запущен...');
console.log(`📂 [BRIDGE] Директория данных: ${DATA_DIR}`);

// Функция генерации конфига PJSIP
function generatePjsipConfig(extensions) {
  let config = '';
  extensions.forEach(ext => {
    config += `; --- Абонент ${ext.id} (${ext.name}) ---\n`;
    
    // Auth
    config += `[${ext.id}-auth](!)\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
    
    // AOR
    config += `[${ext.id}-aor](!)\ntype=aor\nmax_contacts=1\nremove_existing=yes\n\n`;
    
    // Endpoint
    config += `[${ext.id}]\ntype=endpoint\ncontext=from-internal\ndisallow=all\nallow=ulaw,alaw,g722\nauth=${ext.id}-auth\naors=${ext.id}-aor\ndirect_media=no\nrewrite_contact=yes\n\n`;
  });
  return config;
}

// Функция синхронизации
async function sync() {
  console.log('🔄 [BRIDGE] Начало синхронизации...');
  try {
    const extPath = path.join(DATA_DIR, 'extensions.json');
    if (!fs.existsSync(extPath)) {
      console.log('⚠️ [BRIDGE] Файл extensions.json не найден. Пропуск.');
      return;
    }

    const extensions = JSON.parse(fs.readFileSync(extPath, 'utf8'));
    const pjsipConfig = generatePjsipConfig(extensions);

    // Запись в системный конфиг Asterisk
    fs.writeFileSync(PJSIP_FILE, pjsipConfig);
    console.log(`✅ [BRIDGE] Файл ${PJSIP_FILE} успешно обновлен. Абонентов: ${extensions.length}`);

    // Перезагрузка PJSIP через AMI
    // Пробуем разные команды для разных версий Asterisk
    const reloadCommands = ['module reload res_pjsip.so', 'pjsip reload', 'core reload'];
    
    let success = false;
    for (const cmd of reloadCommands) {
      if (success) break;
      
      try {
        await new Promise((resolve, reject) => {
          ami.action({
            action: 'Command',
            command: cmd
          }, (err, res) => {
            if (err || (res && res.response === 'Error' && !res.output)) {
              reject(err || res);
            } else {
              console.log(`🔄 [BRIDGE] Asterisk Command (${cmd}): OK`);
              success = true;
              resolve(res);
            }
          });
        });
      } catch (e) {
        // Игнорируем ошибки конкретной команды, пробуем следующую
      }
    }

    if (!success) {
      console.error('❌ [BRIDGE] Все команды перезагрузки AMI завершились неудачей.');
    }

  } catch (error) {
    console.error('❌ [BRIDGE] Ошибка синхронизации:', error.message);
  }
}

// Следим за изменениями в папке данных
fs.watch(DATA_DIR, (eventType, filename) => {
  if (filename === 'extensions.json') {
    console.log(`🔔 [BRIDGE] Изменение в ${filename}. Синхронизация...`);
    sync();
  }
});

// Первоначальный запуск
sync();

ami.on('error', (err) => {
  console.error('❌ [BRIDGE] AMI Connection Error:', err.message);
});

ami.on('managerevent', (evt) => {
  // Можно добавить логирование звонков здесь
});
