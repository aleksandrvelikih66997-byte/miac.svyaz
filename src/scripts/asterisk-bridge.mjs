
/**
 * @fileOverview МИАЦ.СВЯЗЬ (Мост) — Синхронизация данных с Asterisk.
 * Добавлена поддержка автоматического копирования аудиофайлов.
 */

import fs from 'fs';
import path from 'path';
import ami from 'asterisk-manager';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '../../');
const DATA_DIR = path.join(PROJECT_ROOT, 'src/data');
const SOUNDS_SRC_DIR = path.join(DATA_DIR, 'sounds');
const ASTERISK_CONF_DIR = '/etc/asterisk';
const ASTERISK_SOUNDS_DIR = '/var/lib/asterisk/sounds';

// Конфигурация AMI
const amiConfig = {
  port: 5038,
  host: '127.0.0.1',
  user: 'miac',
  password: 'MiacAMI2026'
};

const client = ami(amiConfig.port, amiConfig.host, amiConfig.user, amiConfig.password, true);

// Файлы
const FILES = {
  extensions: path.join(DATA_DIR, 'extensions.json'),
  trunks: path.join(DATA_DIR, 'trunks.json'),
  routes: path.join(DATA_DIR, 'routes.json'),
  queues: path.join(DATA_DIR, 'queues.json'),
  ivrs: path.join(DATA_DIR, 'ivrs.json'),
};

console.log('🚀 [BRIDGE] Мост МИАЦ.СВЯЗЬ запущен...');

function readJSON(file) {
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) || [];
  } catch (e) {
    return [];
  }
}

/**
 * Копирует новые аудиофайлы из src/data/sounds в системную директорию Asterisk
 */
function syncSounds() {
  if (!fs.existsSync(SOUNDS_SRC_DIR)) return;
  
  const files = fs.readdirSync(SOUNDS_SRC_DIR);
  files.forEach(file => {
    const src = path.join(SOUNDS_SRC_DIR, file);
    const dest = path.join(ASTERISK_SOUNDS_DIR, file);
    
    try {
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(src, dest);
        fs.chmodSync(dest, 0o666);
        console.log(`🎵 [BRIDGE] Звуковой файл ${file} скопирован в ${ASTERISK_SOUNDS_DIR}`);
      }
    } catch (e) {
      console.error(`❌ [BRIDGE] Ошибка копирования звука ${file}:`, e.message);
    }
  });
}

function syncAll() {
  console.log('🔄 [BRIDGE] Начало синхронизации...');
  syncSounds();

  const extensions = readJSON(FILES.extensions);
  const trunks = readJSON(FILES.trunks);
  const queues = readJSON(FILES.queues);
  const ivrs = readJSON(FILES.ivrs);
  const routes = readJSON(FILES.routes);

  // 1. Генерируем абонентов
  let usersConf = '; Генерируемый файл МИАЦ.СВЯЗЬ - Абоненты\n\n';
  extensions.forEach(ext => {
    usersConf += `[${ext.id}]\ntype=endpoint\nauth=${ext.id}\naors=${ext.id}\ncontext=from-internal\ndisallow=all\nallow=ulaw,alaw\ndirect_media=no\n\n`;
    usersConf += `[${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
    usersConf += `[${ext.id}]\ntype=aor\nmax_contacts=1\nremove_existing=yes\n\n`;
  });
  fs.writeFileSync(path.join(ASTERISK_CONF_DIR, 'pjsip_miac_users.conf'), usersConf);

  // 2. Генерируем транки
  let trunksConf = '; Генерируемый файл МИАЦ.СВЯЗЬ - Транки\n\n';
  trunks.forEach(t => {
    trunksConf += `[${t.name}]\ntype=registration\noutbound_auth=${t.name}_auth\nserver_uri=sip:${t.host}:${t.port}\nclient_uri=sip:${t.user}@${t.host}:${t.port}\nretry_interval=60\n\n`;
    trunksConf += `[${t.name}_auth]\ntype=auth\nauth_type=userpass\nusername=${t.user}\npassword=${t.password}\n\n`;
    trunksConf += `[${t.name}]\ntype=endpoint\ncontext=from-trunk\ndisallow=all\nallow=ulaw,alaw\noutbound_auth=${t.name}_auth\naors=${t.name}\n\n`;
    trunksConf += `[${t.name}]\ntype=aor\ncontact=sip:${t.host}:${t.port}\n\n`;
    trunksConf += `[${t.name}]\ntype=identify\nendpoint=${t.name}\nmatch=${t.host}\n\n`;
  });
  fs.writeFileSync(path.join(ASTERISK_CONF_DIR, 'pjsip_miac_trunks.conf'), trunksConf);

  // 3. Генерируем очереди
  let queuesConf = '; Генерируемый файл МИАЦ.СВЯЗЬ - Очереди\n\n';
  queues.forEach(q => {
    queuesConf += `[${q.name}]\nstrategy=${q.strategy}\nmusiconhold=${q.musicOnHoldClass}\n`;
    (q.members || []).forEach(m => {
      queuesConf += `member => PJSIP/${m}\n`;
    });
    queuesConf += `\n`;
  });
  fs.writeFileSync(path.join(ASTERISK_CONF_DIR, 'queues_miac.conf'), queuesConf);

  // 4. Генерируем диалплан
  let dialplan = '[from-internal]\n';
  extensions.forEach(ext => {
    dialplan += `exten => ${ext.id},1,Dial(PJSIP/${ext.id},30)\n`;
    dialplan += `same => n,Hangup()\n`;
  });

  // Исходящие через транки
  routes.filter(r => r.type === 'outbound').forEach(r => {
    const trunkName = r.destination.split(':')[1];
    dialplan += `exten => _${r.pattern},1,Dial(PJSIP/\${EXTEN}@${trunkName})\n`;
  });

  // IVR Диалплан
  ivrs.forEach(ivr => {
    dialplan += `\n[ivr-${ivr.id}]\nexten => s,1,Answer()\n`;
    dialplan += `same => n,Background(${ivr.announcementFile})\n`;
    dialplan += `same => n,WaitExten(5)\n`;
    
    (ivr.digitMappings || []).forEach(m => {
      const [digit, type, target] = m.split(':');
      if (type === 'ext') dialplan += `exten => ${digit},1,Goto(from-internal,${target},1)\n`;
      if (type === 'queue') dialplan += `exten => ${digit},1,Queue(${target})\n`;
      if (type === 'ivr') dialplan += `exten => ${digit},1,Goto(ivr-${target},s,1)\n`;
    });
  });

  fs.writeFileSync(path.join(ASTERISK_CONF_DIR, 'extensions_miac_dialplan.conf'), dialplan);

  // Команды перезагрузки через AMI
  ['module reload res_pjsip.so', 'module reload app_queue.so', 'dialplan reload'].forEach(cmd => {
    client.action({ action: 'Command', command: cmd }, (err, res) => {
      if (!err) console.log(`🔄 [BRIDGE] Asterisk Command (${cmd}): OK`);
    });
  });

  console.log(`✅ [BRIDGE] Синхронизация завершена. Абонентов: ${extensions.length}, Транков: ${trunks.length}`);
}

// Следим за изменениями в JSON файлах
[FILES.extensions, FILES.trunks, FILES.queues, FILES.ivrs, FILES.routes].forEach(file => {
  if (fs.existsSync(file)) {
    fs.watch(file, () => syncAll());
  }
});

// Периодическая проверка статусов
setInterval(() => {
  client.action({ action: 'PJSIPShowEndpoints' }, (err, res) => {
    if (err) return;
    const extensions = readJSON(FILES.extensions);
    let changed = false;
    
    // Здесь должна быть логика парсинга ответа AMI для обновления статусов в JSON
    // Для прототипа мы просто логируем активность
  });
}, 5000);

syncAll();
