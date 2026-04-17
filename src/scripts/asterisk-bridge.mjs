import fs from 'fs';
import path from 'path';
import asteriskManager from 'asterisk-manager';

/**
 * МИАЦ.СВЯЗЬ BRIDGE
 * Синхронизирует JSON базу проекта с конфигами Asterisk в /etc/asterisk/
 */

const AMI_PORT = 5038;
const AMI_HOST = '127.0.0.1';
const AMI_USER = 'miac';
const AMI_SECRET = 'MiacAMI2026';

const DATA_DIR = path.join(process.cwd(), 'src/data');
const SOUNDS_DIR = path.join(DATA_DIR, 'sounds');
const ASTERISK_DIR = '/etc/asterisk';
const ASTERISK_SOUNDS = '/var/lib/asterisk/sounds';

const FILES = {
  users: path.join(DATA_DIR, 'extensions.json'),
  trunks: path.join(DATA_DIR, 'trunks.json'),
  queues: path.join(DATA_DIR, 'queues.json'),
  ivrs: path.join(DATA_DIR, 'ivrs.json'),
  routes: path.join(DATA_DIR, 'routes.json'),
};

const am = asteriskManager(AMI_PORT, AMI_HOST, AMI_USER, AMI_SECRET, true);

am.on('managerevent', (evt) => {
  // Логирование событий для отладки
  if (evt.event === 'FullyBooted') console.log('✅ [AMI] Соединение установлено.');
});

async function reloadModule(module) {
  return new Promise((resolve) => {
    am.action({ action: 'Command', command: `module reload ${module}` }, (err, res) => {
      if (err) console.error(`❌ [AMI] Ошибка reload ${module}:`, err);
      else console.log(`🔄 [AMI] Команда reload ${module}: ${res.response}`);
      resolve();
    });
  });
}

function syncUsers() {
  if (!fs.existsSync(FILES.users)) return;
  const users = JSON.parse(fs.readFileSync(FILES.users, 'utf8') || '[]');
  let config = '; Генерируемый файл МИАЦ.СВЯЗЬ - НЕ РЕДАКТИРОВАТЬ\n\n';

  users.forEach(u => {
    config += `[${u.id}]\ntype=endpoint\ncontext=from-internal\ndisallow=all\nallow=ulaw,alaw\nauth=${u.id}\naors=${u.id}\ntransport=transport-udp-nat\n\n`;
    config += `[${u.id}]\ntype=auth\nauth_type=userpass\nusername=${u.id}\npassword=${u.secret}\n\n`;
    config += `[${u.id}]\ntype=aor\nmax_contacts=1\n\n`;
  });

  fs.writeFileSync(path.join(ASTERISK_DIR, 'pjsip_miac_users.conf'), config);
  console.log('✅ [BRIDGE] Обновлен pjsip_miac_users.conf');
  reloadModule('res_pjsip.so');
}

function syncTrunks() {
  if (!fs.existsSync(FILES.trunks)) return;
  const trunks = JSON.parse(fs.readFileSync(FILES.trunks, 'utf8') || '[]');
  let config = '; Генерируемый файл МИАЦ.СВЯЗЬ - ТРАНКИ\n\n';

  trunks.forEach(t => {
    config += `[${t.id}]\ntype=registration\noutbound_auth=${t.id}\nserver_uri=sip:${t.host}:${t.port}\nclient_uri=sip:${t.user}@${t.host}:${t.port}\n\n`;
    config += `[${t.id}]\ntype=auth\nauth_type=userpass\nusername=${t.user}\npassword=${t.password}\n\n`;
    config += `[${t.id}]\ntype=endpoint\ncontext=from-trunk\ndisallow=all\nallow=ulaw,alaw\noutbound_auth=${t.id}\naors=${t.id}\n\n`;
    config += `[${t.id}]\ntype=aor\ncontact=sip:${t.host}:${t.port}\n\n`;
    config += `[${t.id}]\ntype=identify\nendpoint=${t.id}\nmatch=${t.host}\n\n`;
  });

  fs.writeFileSync(path.join(ASTERISK_DIR, 'pjsip_miac_trunks.conf'), config);
  console.log('✅ [BRIDGE] Обновлен pjsip_miac_trunks.conf');
  reloadModule('res_pjsip.so');
}

function syncQueues() {
  if (!fs.existsSync(FILES.queues)) return;
  const queues = JSON.parse(fs.readFileSync(FILES.queues, 'utf8') || '[]');
  let config = '; Генерируемый файл МИАЦ.СВЯЗЬ - ОЧЕРЕДИ\n\n';

  queues.forEach(q => {
    config += `[${q.name}]\nstrategy=${q.strategy}\nmusicclass=${q.musicOnHoldClass || 'default'}\ntimeout=15\nretry=5\nwrapuptime=0\n`;
    (q.members || []).forEach(m => {
      config += `member => PJSIP/${m}\n`;
    });
    config += `\n`;
  });

  fs.writeFileSync(path.join(ASTERISK_DIR, 'queues_miac.conf'), config);
  console.log('✅ [BRIDGE] Обновлен queues_miac.conf');
  reloadModule('app_queue.so');
}

function syncDialplan() {
  const users = fs.existsSync(FILES.users) ? JSON.parse(fs.readFileSync(FILES.users, 'utf8') || '[]') : [];
  const routes = fs.existsSync(FILES.routes) ? JSON.parse(fs.readFileSync(FILES.routes, 'utf8') || '[]') : [];
  const ivrs = fs.existsSync(FILES.ivrs) ? JSON.parse(fs.readFileSync(FILES.ivrs, 'utf8') || '[]') : [];
  
  let config = '; Генерируемый файл МИАЦ.СВЯЗЬ - DIALPLAN\n\n[from-internal]\n';
  
  // Внутренняя связь
  users.forEach(u => {
    config += `exten => ${u.id},1,Dial(PJSIP/${u.id},30)\n`;
    config += `same => n,Hangup()\n`;
  });

  // Исходящие маршруты
  routes.filter(r => r.type === 'outbound').forEach(r => {
    const trunkId = r.destination.split(':')[1];
    config += `exten => _${r.pattern},1,Dial(PJSIP/\${EXTEN}@${trunkId})\n`;
    config += `same => n,Hangup()\n`;
  });

  // Входящие маршруты и IVR
  config += `\n[from-trunk]\n`;
  routes.filter(r => r.type === 'inbound').forEach(r => {
    const [type, id] = r.destination.split(':');
    if (type === 'Extension') config += `exten => ${r.pattern},1,Dial(PJSIP/${id})\n`;
    if (type === 'Queue') config += `exten => ${r.pattern},1,Queue(${id})\n`;
    if (type === 'IVR') config += `exten => ${r.pattern},1,Goto(ivr-${id},s,1)\n`;
  });

  // Генерация контекстов IVR
  ivrs.forEach(ivr => {
    config += `\n[ivr-${ivr.id}]\nexten => s,1,Answer()\n`;
    config += `same => n,Background(${ivr.announcementFile})\n`;
    config += `same => n,WaitExten(5)\n`;
    
    (ivr.digitMappings || []).forEach(m => {
      const [digit, type, target] = m.split(':');
      if (type === 'ext') config += `exten => ${digit},1,Dial(PJSIP/${target})\n`;
      if (type === 'queue') config += `exten => ${digit},1,Queue(${target})\n`;
    });
    config += `exten => t,1,Hangup()\nexten => i,1,Playback(invalid)\nsame => n,Goto(s,1)\n`;
  });

  fs.writeFileSync(path.join(ASTERISK_DIR, 'extensions_miac_dialplan.conf'), config);
  console.log('✅ [BRIDGE] Обновлен extensions_miac_dialplan.conf');
  reloadModule('pbx_config.so');
}

function syncSounds() {
  if (!fs.existsSync(SOUNDS_DIR)) return;
  const files = fs.readdirSync(SOUNDS_DIR);
  files.forEach(f => {
    const src = path.join(SOUNDS_DIR, f);
    const dest = path.join(ASTERISK_SOUNDS, f);
    if (!fs.existsSync(dest) || fs.statSync(src).mtime > fs.statSync(dest).mtime) {
      fs.copyFileSync(src, dest);
      fs.chmodSync(dest, 0o666);
      console.log(`🎵 [BRIDGE] Синхронизирован звук: ${f}`);
    }
  });
}

function updateStatuses() {
  am.action({ action: 'PJSIPShowEndpoints' }, (err, res) => {
    if (err || !fs.existsSync(FILES.users)) return;
    const users = JSON.parse(fs.readFileSync(FILES.users, 'utf8') || '[]');
    // Упрощенная логика: AMI возвращает список эндпоинтов, мы ищем вхождение ID
    // В реальном AMI ответе приходят события EndpointList
  });
}

// Запуск наблюдателей
console.log('🚀 [BRIDGE] Мост МИАЦ.СВЯЗЬ запущен...');

fs.watch(DATA_DIR, (eventType, filename) => {
  if (!filename.endsWith('.json')) return;
  console.log(`🔄 [BRIDGE] Изменение в ${filename}, синхронизация...`);
  setTimeout(() => {
    syncUsers();
    syncTrunks();
    syncQueues();
    syncDialplan();
  }, 100);
});

fs.watch(SOUNDS_DIR, () => syncSounds());

// Первоначальная синхронизация
syncUsers();
syncTrunks();
syncQueues();
syncDialplan();
syncSounds();
setInterval(updateStatuses, 5000);
