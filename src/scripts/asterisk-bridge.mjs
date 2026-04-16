
import fs from 'fs';
import path from 'path';
import asteriskManager from 'asterisk-manager';

/**
 * @fileOverview Мост между локальной базой JSON и Asterisk 17/20.
 * Обеспечивает мгновенную синхронизацию PJSIP абонентов.
 */

const DATA_DIR = path.join(process.cwd(), 'src/data');
const EXTENSIONS_FILE = path.join(DATA_DIR, 'extensions.json');
const TARGET_CONF = '/etc/asterisk/pjsip_miac_users.conf';

// Настройки AMI (должны совпадать с manager.conf)
const ami = asteriskManager(5038, '127.0.0.1', 'miac', 'MiacAMI2026', true);

function generatePjsipConfig(extensions) {
  // Базовый транспорт — критически важен для Asterisk 17/20
  let config = `
; --- Сгенерировано МИАЦ.СВЯЗЬ ---
; Не редактируйте этот файл вручную

[transport-udp]
type=transport
protocol=udp
bind=0.0.0.0:5060

`;

  extensions.forEach(ext => {
    config += `
; Абонент: ${ext.name || ext.id}
[${ext.id}]
type=auth
auth_type=userpass
password=${ext.secret}
username=${ext.id}

[${ext.id}]
type=aor
max_contacts=1
remove_existing=yes

[${ext.id}]
type=endpoint
auth=${ext.id}
outbound_auth=${ext.id}
aors=${ext.id}
context=${ext.context || 'from-internal'}
disallow=all
allow=ulaw,alaw,g722
direct_media=no
force_rport=yes
rewrite_contact=yes
rtp_symmetric=yes
transport=transport-udp

`;
  });

  return config;
}

async function syncToAsterisk() {
  console.log('🔄 [BRIDGE] Начало синхронизации...');
  
  if (!fs.existsSync(EXTENSIONS_FILE)) {
    console.log('⚠️ [BRIDGE] Файл абонентов не найден. Создаю пустой конфиг.');
    fs.writeFileSync(TARGET_CONF, '; No extensions found');
    return;
  }

  try {
    const extensions = JSON.parse(fs.readFileSync(EXTENSIONS_FILE, 'utf8'));
    const configContent = generatePjsipConfig(extensions);
    
    // Пишем в файл Asterisk
    fs.writeFileSync(TARGET_CONF, configContent);
    console.log(`✅ [BRIDGE] Файл ${TARGET_CONF} успешно обновлен. Абонентов: ${extensions.length}`);

    // Даем команду на перезагрузку через AMI
    // Пробуем разные команды для разных версий Asterisk
    const commands = ['module reload res_pjsip.so', 'pjsip reload', 'core reload'];
    
    for (const cmd of commands) {
      try {
        await new Promise((resolve, reject) => {
          ami.action({
            action: 'Command',
            command: cmd
          }, (err, res) => {
            if (err || (res && res.response === 'Error')) {
              reject(err || res);
            } else {
              console.log(`🔄 [BRIDGE] Asterisk Command (${cmd}): OK`);
              resolve(res);
            }
          });
        });
        break; // Если команда прошла, выходим из цикла
      } catch (e) {
        // Пробуем следующую команду
      }
    }

  } catch (error) {
    console.error('❌ [BRIDGE] Ошибка при синхронизации:', error.message);
  }
}

// Первоначальная синхронизация
syncToAsterisk();

// Следим за изменениями в JSON файле
console.log(`🚀 [BRIDGE] Мост МИАЦ.СВЯЗЬ запущен...`);
console.log(`📂 [BRIDGE] Ожидание изменений в базе данных...`);

fs.watch(DATA_DIR, (eventType, filename) => {
  if (filename === 'extensions.json') {
    syncToAsterisk();
  }
});

ami.on('error', (err) => {
  console.error('❌ [BRIDGE] AMI Error:', err.message);
});
