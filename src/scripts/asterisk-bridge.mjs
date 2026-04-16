
import fs from 'fs';
import path from 'path';
import ami from 'asterisk-manager';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '../..');
const DATA_DIR = path.join(ROOT_DIR, 'src/data');
const PJSIP_FILE = '/etc/asterisk/pjsip_miac_users.conf';

// Настройки AMI (согласно вашему manager.conf)
const amiClient = ami(5038, '127.0.0.1', 'miac', 'MiacAMI2026', true);

function readJSON(filename) {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) return [];
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error(`❌ [BRIDGE] Ошибка чтения ${filename}:`, e.message);
    return [];
  }
}

function syncFiles() {
  console.log('🔄 [BRIDGE] Начало синхронизации...');
  
  const extensions = readJSON('extensions.json');
  let configContent = '; --- Сгенерировано МИАЦ.СВЯЗЬ ---\n\n';

  if (extensions.length === 0) {
    console.log('⚠️ [BRIDGE] Абоненты не найдены в базе данных.');
  }

  extensions.forEach(ext => {
    console.log(`📡 [BRIDGE] Обработка абонента: ${ext.id} (${ext.name})`);
    
    // Генерируем полный PJSIP блок (Endpoint + Auth + AOR)
    configContent += `
[${ext.id}]
type=endpoint
context=${ext.context || 'from-internal'}
disallow=all
allow=ulaw,alaw,g722
auth=${ext.id}
aors=${ext.id}
callerid=${ext.name} <${ext.id}>
direct_media=no

[${ext.id}]
type=auth
auth_type=userpass
username=${ext.id}
password=${ext.secret}

[${ext.id}]
type=aor
max_contacts=1
remove_existing=yes
\n`;
  });

  try {
    fs.writeFileSync(PJSIP_FILE, configContent);
    console.log(`✅ [BRIDGE] Файл ${PJSIP_FILE} успешно обновлен. Абонентов: ${extensions.length}`);
    
    // Даем команду Asterisk на перезагрузку PJSIP
    amiClient.action({
      action: 'Command',
      command: 'pjsip reload'
    }, (err, res) => {
      if (err) console.error('❌ [BRIDGE] AMI Error:', err);
      else console.log('🚀 [BRIDGE] Asterisk PJSIP Reload: OK');
    });

  } catch (e) {
    console.error(`❌ [BRIDGE] Ошибка записи в ${PJSIP_FILE}:`, e.message);
    console.log('👉 Убедитесь, что вы выполнили: chmod 666 ' + PJSIP_FILE);
  }
}

console.log('🚀 [BRIDGE] Мост МИАЦ.СВЯЗЬ запущен...');
console.log(`📂 [BRIDGE] Директория данных: ${DATA_DIR}`);

// Следим за изменениями в папке данных
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

fs.watch(DATA_DIR, (eventType, filename) => {
  if (filename && filename.endsWith('.json')) {
    console.log(`📝 [BRIDGE] Изменение в файле: ${filename}`);
    syncFiles();
  }
});

// Первичная синхронизация при запуске
syncFiles();

// Обработка ошибок AMI
amiClient.on('error', (err) => {
  console.error('❌ [BRIDGE] AMI Connection Error:', err.message);
});
