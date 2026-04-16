
import fs from 'fs';
import path from 'path';
import asteriskManager from 'asterisk-manager';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Константы путей
const DATA_DIR = path.join(process.cwd(), 'src/data');
const EXTENSIONS_FILE = path.join(DATA_DIR, 'extensions.json');
const ASTERISK_CONF_FILE = '/etc/asterisk/pjsip_miac_users.conf';

// Конфиг AMI (должен совпадать с manager.conf)
const AMI_CONFIG = {
  port: 5038,
  host: '127.0.0.1',
  username: 'miac',
  password: 'MiacAMI2026'
};

console.log('🚀 [BRIDGE] Мост МИАЦ.СВЯЗЬ запущен...');
console.log(`📂 [BRIDGE] Директория данных: ${DATA_DIR}`);

// Функция синхронизации
async function sync() {
  console.log('🔄 [BRIDGE] Начало синхронизации...');
  
  if (!fs.existsSync(EXTENSIONS_FILE)) {
    console.log('⚠️ [BRIDGE] Файл абонентов не найден. Пропускаю.');
    return;
  }

  try {
    const extensions = JSON.parse(fs.readFileSync(EXTENSIONS_FILE, 'utf8'));
    
    // Генерируем конфиг PJSIP (Asterisk 17/20 совместимый)
    let config = `; --- Сгенерировано МИАЦ.СВЯЗЬ (${new Date().toLocaleString()}) ---\n\n`;
    
    // Добавляем базовый транспорт (обязательно для работы PJSIP)
    config += `[transport-udp]\ntype=transport\nprotocol=udp\nbind=0.0.0.0:5060\n\n`;

    extensions.forEach(ext => {
      console.log(`📡 [BRIDGE] Обработка абонента: ${ext.id} (${ext.name})`);
      
      config += `[${ext.id}]\ntype=endpoint\ncontext=${ext.context || 'from-internal'}\ndisallow=all\nallow=ulaw,alaw,g722\nauth=${ext.id}\naors=${ext.id}\ndirect_media=no\n\n`;
      config += `[${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
      config += `[${ext.id}]\ntype=aor\nmax_contacts=1\nremove_existing=yes\n\n`;
    });

    // Пишем в файл Asterisk
    fs.writeFileSync(ASTERISK_CONF_FILE, config);
    console.log(`✅ [BRIDGE] Файл ${ASTERISK_CONF_FILE} успешно обновлен. Абонентов: ${extensions.length}`);

    // Отправляем команду в Asterisk через AMI
    const ami = new asteriskManager(AMI_CONFIG.port, AMI_CONFIG.host, AMI_CONFIG.username, AMI_CONFIG.password, true);
    
    ami.on('managerevent', () => {}); // Игнорируем события
    
    // Ждем подключения
    await new Promise((resolve, reject) => {
      ami.keepconnected();
      
      const timeout = setTimeout(() => reject(new Error('AMI Timeout')), 3000);
      
      ami.on('rawevent', (evt) => {
        if (evt.event === 'FullyAuthenticated' || evt.response === 'Success') {
          clearTimeout(timeout);
          resolve();
        }
      });
      
      ami.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    // Пробуем перезагрузить PJSIP в Asterisk 17
    const commands = ['module reload res_pjsip.so', 'pjsip reload', 'core reload'];
    
    for (const cmd of commands) {
      try {
        const result = await new Promise((res, rej) => {
          ami.action({ action: 'Command', command: cmd }, (err, msg) => {
            if (err || msg.response === 'Error') rej(err || msg);
            else res(msg);
          });
        });
        console.log(`🔄 [BRIDGE] Asterisk Command (${cmd}): OK`);
        break; // Если сработало, выходим из цикла
      } catch (e) {
        // Пробуем следующую команду
      }
    }

    ami.disconnect();

  } catch (error) {
    console.error('❌ [BRIDGE] Error:', error.message || error);
  }
}

// Первоначальный запуск
sync();

// Следим за изменениями в JSON файлах
fs.watch(DATA_DIR, (eventType, filename) => {
  if (filename === 'extensions.json') {
    console.log(`📝 [BRIDGE] Замечено изменение в ${filename}...`);
    sync();
  }
});
