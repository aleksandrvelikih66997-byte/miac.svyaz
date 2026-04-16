
import fs from 'fs';
import path from 'path';
import asteriskManager from 'asterisk-manager';
import dotenv from 'dotenv';

dotenv.config();

const DATA_DIR = path.join(process.cwd(), 'src/data');
const EXTENSIONS_FILE = path.join(DATA_DIR, 'extensions.json');
const TARGET_CONF = '/etc/asterisk/pjsip_miac_users.conf';

// Конфигурация AMI из manager.conf
const ami = asteriskManager(
  5038,
  '127.0.0.1',
  'miac',
  'MiacAMI2026',
  true
);

ami.keepConnected();

function generatePjsipConfig(extensions) {
  let config = '; --- МИАЦ.СВЯЗЬ: Автоматическая конфигурация ---\n';
  config += '; Сгенерировано: ' + new Date().toLocaleString() + '\n\n';

  // ВАЖНО для Asterisk 17: Определяем транспорт, если он не определен глобально
  config += '[transport-udp]\n';
  config += 'type=transport\n';
  config += 'protocol=udp\n';
  config += 'bind=0.0.0.0:5060\n\n';

  extensions.forEach(ext => {
    const id = ext.id;
    const secret = ext.secret || 'password';
    const context = ext.context || 'from-internal';

    // Блок AOR (Адрес ресурса)
    config += `[${id}]\n`;
    config += `type=aor\n`;
    config += `max_contacts=1\n`;
    config += `remove_existing=yes\n\n`;

    // Блок AUTH (Авторизация)
    config += `[${id}]\n`;
    config += `type=auth\n`;
    config += `auth_type=userpass\n`;
    config += `username=${id}\n`;
    config += `password=${secret}\n\n`;

    // Блок ENDPOINT (Точка подключения)
    config += `[${id}]\n`;
    config += `type=endpoint\n`;
    config += `context=${context}\n`;
    config += `disallow=all\n`;
    config += `allow=ulaw,alaw\n`;
    config += `auth=${id}\n`;
    config += `outbound_auth=${id}\n`;
    config += `aors=${id}\n`;
    config += `transport=transport-udp\n`; // Привязка к транспорту
    config += `direct_media=no\n`;
    config += `rewrite_contact=yes\n`;
    config += `force_rport=yes\n`;
    config += `rtp_symmetric=yes\n\n`;
  });

  return config;
}

async function syncToAsterisk() {
  console.log('🔄 [BRIDGE] Начало синхронизации...');
  
  if (!fs.existsSync(EXTENSIONS_FILE)) {
    console.log('⚠️ [BRIDGE] Файл данных не найден, создаю пустой конфиг.');
    fs.writeFileSync(TARGET_CONF, '; Нет активных абонентов\n');
    return;
  }

  try {
    const extensions = JSON.parse(fs.readFileSync(EXTENSIONS_FILE, 'utf8'));
    const configContent = generatePjsipConfig(extensions);
    
    fs.writeFileSync(TARGET_CONF, configContent);
    console.log(`✅ [BRIDGE] Файл ${TARGET_CONF} успешно обновлен. Абонентов: ${extensions.length}`);

    // Пробуем перезагрузить PJSIP через AMI
    // В Asterisk 17 самая надежная команда: module reload res_pjsip.so
    const commands = ['module reload res_pjsip.so', 'pjsip reload', 'core reload'];
    
    for (const cmd of commands) {
      try {
        const response = await new Promise((resolve, reject) => {
          ami.action({
            action: 'Command',
            command: cmd
          }, (err, res) => {
            if (err) reject(err);
            else resolve(res);
          });
        });

        if (response.response === 'Success' || response.message === 'Command output follows') {
          console.log(`🔄 [BRIDGE] Asterisk Command (${cmd}): OK`);
          break; 
        }
      } catch (e) {
        // Пробуем следующую команду, если текущая не поддерживается
      }
    }

  } catch (error) {
    console.error('❌ [BRIDGE] Ошибка при синхронизации:', error.message);
  }
}

// Следим за изменениями в файле данных
console.log('🚀 [BRIDGE] Мост МИАЦ.СВЯЗЬ запущен...');
console.log(`📂 [BRIDGE] Директория данных: ${DATA_DIR}`);

fs.watch(DATA_DIR, (eventType, filename) => {
  if (filename === 'extensions.json') {
    syncToAsterisk();
  }
});

// Первоначальный запуск
syncToAsterisk();
