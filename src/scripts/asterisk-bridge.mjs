
import fs from 'fs';
import path from 'path';
import asteriskManager from 'asterisk-manager';

/**
 * АВТОНОМНЫЙ МОСТ МИАЦ.СВЯЗЬ (v2.1)
 * Синхронизирует локальную базу JSON с конфигурацией Asterisk PJSIP.
 */

const DATA_DIR = path.join(process.cwd(), 'src/data');
const EXTENSIONS_FILE = path.join(DATA_DIR, 'extensions.json');
const TARGET_CONF = '/etc/asterisk/pjsip_miac_users.conf';

// Конфигурация AMI (должна совпадать с manager.conf)
const amiConfig = {
  port: 5038,
  host: '127.0.0.1',
  user: 'miac',
  password: 'MiacAMI2026'
};

console.log('🚀 [BRIDGE] Мост МИАЦ.СВЯЗЬ запущен...');
console.log(`📂 [BRIDGE] Директория данных: ${DATA_DIR}`);

/**
 * Генерация PJSIP конфига для Asterisk 17/20
 */
function generatePjsipConfig(extensions) {
  let config = '; АВТОМАТИЧЕСКИ СГЕНЕРИРОВАНО МИАЦ.СВЯЗЬ\n';
  config += `; Дата обновления: ${new Date().toLocaleString()}\n\n`;

  extensions.forEach(ext => {
    // 1. Endpoint
    config += `[${ext.id}]\ntype=endpoint\ncontext=${ext.context || 'from-internal'}\ndisallow=all\nallow=ulaw,alaw,g722\nauth=${ext.id}\naors=${ext.id}\ndirect_media=no\n`;
    if (ext.name) config += `callerid=${ext.name} <${ext.id}>\n`;
    
    // 2. Auth
    config += `\n[${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n`;
    
    // 3. AOR
    config += `\n[${ext.id}]\ntype=aor\nmax_contacts=1\nremove_existing=yes\n\n`;
    config += `--------------------------------------------------\n\n`;
  });

  return config;
}

/**
 * Синхронизация данных
 */
function sync() {
  console.log('🔄 [BRIDGE] Начало синхронизации...');
  
  if (!fs.existsSync(EXTENSIONS_FILE)) {
    console.log('⚠️ [BRIDGE] Файл данных абонентов не найден.');
    return;
  }

  try {
    const extensions = JSON.parse(fs.readFileSync(EXTENSIONS_FILE, 'utf8'));
    console.log(`📡 [BRIDGE] Обработка абонентов. Найдено: ${extensions.length}`);
    
    const configContent = generatePjsipConfig(extensions);
    fs.writeFileSync(TARGET_CONF, configContent);
    console.log(`✅ [BRIDGE] Файл ${TARGET_CONF} успешно обновлен.`);

    // Уведомляем Asterisk через AMI
    const ami = new asteriskManager(amiConfig.port, amiConfig.host, amiConfig.user, amiConfig.password, true);
    
    ami.on('error', (err) => {
      console.log(`❌ [BRIDGE] AMI Connection Error: ${err.message}`);
      console.log(`💡 Подсказка: Проверьте 'asterisk -rx "manager show settings"' и наличие 'manager.conf'`);
      ami.disconnect();
    });

    ami.on('managerevent', (evt) => {}); // Игнорируем события

    ami.keepalive(); // Поддерживаем связь

    // Выполняем reload через 1 секунду после подключения
    setTimeout(() => {
      ami.action({
        action: 'Command',
        command: 'pjsip reload'
      }, (err, res) => {
        if (err) console.log(`❌ [BRIDGE] Asterisk Reload Error: ${err.message}`);
        else console.log('🔄 [BRIDGE] Asterisk PJSIP Reload: OK');
        ami.disconnect();
      });
    }, 1000);

  } catch (error) {
    console.log(`❌ [BRIDGE] Ошибка синхронизации: ${error.message}`);
  }
}

// Следим за изменениями в папке данных
fs.watch(DATA_DIR, (eventType, filename) => {
  if (filename === 'extensions.json' || filename === 'trunks.json') {
    sync();
  }
});

// Первая синхронизация при запуске
sync();
