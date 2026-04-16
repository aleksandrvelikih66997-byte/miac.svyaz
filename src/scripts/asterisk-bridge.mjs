
import fs from 'fs';
import path from 'path';
import asteriskManager from 'asterisk-manager';
import dotenv from 'dotenv';

dotenv.config();

const DATA_DIR = path.join(process.cwd(), 'src/data');
const EXTENSIONS_FILE = path.join(DATA_DIR, 'extensions.json');
const TARGET_CONF = '/etc/asterisk/pjsip_miac_users.conf';

// Конфигурация AMI (должна совпадать с manager.conf)
const ami = asteriskManager(5038, '127.0.0.1', 'miac', 'MiacAMI2026', true);

let isAmiConnected = false;

ami.on('managerevent', (evt) => {
  // Можно обрабатывать события регистрации здесь в будущем
});

ami.on('connect', () => {
  console.log('✅ [BRIDGE] Подключено к Asterisk AMI');
  isAmiConnected = true;
  syncAll();
});

ami.on('error', (err) => {
  console.error('❌ [BRIDGE] AMI Error:', err.message);
  isAmiConnected = false;
});

// Функция для применения настроек в Asterisk
async function reloadAsterisk() {
  if (!isAmiConnected) return;

  const commands = [
    'module reload res_pjsip.so',
    'pjsip reload',
    'core reload'
  ];

  for (const cmd of commands) {
    try {
      await new Promise((resolve, reject) => {
        ami.action({
          action: 'Command',
          command: cmd
        }, (err, res) => {
          if (err || res.response === 'Error') reject(err || res);
          else {
            console.log(`🔄 [BRIDGE] Asterisk Command (${cmd}): OK`);
            resolve(res);
          }
        });
      });
      break; // Если одна команда сработала, остальные не нужны
    } catch (e) {
      // Пробуем следующую команду
    }
  }
}

// Функция обновления статусов абонентов из Asterisk
function updateStatuses() {
  if (!isAmiConnected) return;

  ami.action({
    action: 'Command',
    command: 'pjsip show endpoints'
  }, (err, res) => {
    if (err || !res.output) return;

    try {
      const extensions = JSON.parse(fs.readFileSync(EXTENSIONS_FILE, 'utf8'));
      let changed = false;

      const output = Array.isArray(res.output) ? res.output.join('\n') : res.output;
      
      extensions.forEach(ext => {
        const id = ext.id;
        // Ищем строку с эндпоинтом и его статус
        const regex = new RegExp(`${id}\\s+\\/\\s+${id}\\s+(\\w+)`, 'i');
        const match = output.match(regex);
        
        let newStatus = 'offline';
        if (match) {
          const astStatus = match[1].toLowerCase();
          if (astStatus === 'avail' || astStatus === 'not_inuse' || astStatus === 'reachable') newStatus = 'online';
          else if (astStatus === 'unavailable') newStatus = 'offline';
          else if (astStatus === 'busy' || astStatus === 'inuse') newStatus = 'busy';
        }

        if (ext.status !== newStatus) {
          ext.status = newStatus;
          changed = true;
        }
      });

      if (changed) {
        fs.writeFileSync(EXTENSIONS_FILE, JSON.stringify(extensions, null, 2));
        // Мы не вызываем syncAll здесь, чтобы не зациклиться
      }
    } catch (e) {
      // Ошибка парсинга или чтения
    }
  });
}

// Основная функция синхронизации
function syncAll() {
  console.log('🔄 [BRIDGE] Начало синхронизации конфигурации...');
  
  if (!fs.existsSync(EXTENSIONS_FILE)) {
    console.log('⚠️ [BRIDGE] Файл абонентов не найден.');
    return;
  }

  try {
    const extensions = JSON.parse(fs.readFileSync(EXTENSIONS_FILE, 'utf8'));
    
    let confContent = `; ГЕНЕРИРУЕМЫЙ ФАЙЛ МИАЦ.СВЯЗЬ
; НЕ РЕДАКТИРОВАТЬ ВРУЧНУЮ
; Дата обновления: ${new Date().toLocaleString()}

`;

    // МЫ НЕ ГЕНЕРИРУЕМ ТРАНСПОРТ ТУТ, ТАК КАК ОН УЖЕ ЕСТЬ В PJSIP.CONF
    // Используем [transport-udp-nat] из основного файла пользователя

    extensions.forEach(ext => {
      confContent += `
[${ext.id}]
type=endpoint
context=from-internal
disallow=all
allow=ulaw,alaw,g722
auth=${ext.id}
aors=${ext.id}
transport=transport-udp-nat
callerid=${ext.name} <${ext.id}>
direct_media=no

[${ext.id}]
type=auth
auth_type=userpass
password=${ext.secret}
username=${ext.id}

[${ext.id}]
type=aor
max_contacts=1
remove_existing=yes
`;
    });

    fs.writeFileSync(TARGET_CONF, confContent);
    console.log(`✅ [BRIDGE] Файл ${TARGET_CONF} успешно обновлен. Абонентов: ${extensions.length}`);
    
    reloadAsterisk();
  } catch (err) {
    console.error('❌ [BRIDGE] Ошибка при записи конфига:', err.message);
  }
}

// Следим за изменениями в JSON файле
fs.watch(DATA_DIR, (eventType, filename) => {
  if (filename === 'extensions.json') {
    syncAll();
  }
});

// Интервал для обновления статусов (раз в 5 секунд)
setInterval(updateStatuses, 5000);

console.log('🚀 [BRIDGE] Мост МИАЦ.СВЯЗЬ запущен...');
console.log(`📂 [BRIDGE] Директория данных: ${DATA_DIR}`);
syncAll();
