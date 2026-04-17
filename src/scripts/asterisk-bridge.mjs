
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

const DATA_DIR = path.join(process.cwd(), 'src/data');
const SOUNDS_DIR = path.join(DATA_DIR, 'sounds');
const ASTERISK_CONF_DIR = '/etc/asterisk';
const ASTERISK_SOUNDS_DIR = '/var/lib/asterisk/sounds/ru';

// Создание необходимых папок
if (!fs.existsSync(SOUNDS_DIR)) {
  fs.mkdirSync(SOUNDS_DIR, { recursive: true });
}

const FILES = {
  extensions: path.join(DATA_DIR, 'extensions.json'),
  trunks: path.join(DATA_DIR, 'trunks.json'),
  routes: path.join(DATA_DIR, 'routes.json'),
  queues: path.join(DATA_DIR, 'queues.json'),
  ivrs: path.join(DATA_DIR, 'ivrs.json'),
};

const OUTPUT_FILES = {
  users: path.join(ASTERISK_CONF_DIR, 'pjsip_miac_users.conf'),
  trunks: path.join(ASTERISK_CONF_DIR, 'pjsip_miac_trunks.conf'),
  queues: path.join(ASTERISK_CONF_DIR, 'queues_miac.conf'),
  dialplan: path.join(ASTERISK_CONF_DIR, 'extensions_miac_dialplan.conf'),
};

function readJSON(file) {
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return [];
  }
}

function syncSounds() {
  if (!fs.existsSync(SOUNDS_DIR)) return;
  const files = fs.readdirSync(SOUNDS_DIR);
  files.forEach(file => {
    const src = path.join(SOUNDS_DIR, file);
    const dest = path.join(ASTERISK_SOUNDS_DIR, file);
    try {
      if (!fs.existsSync(ASTERISK_SOUNDS_DIR)) {
         fs.mkdirSync(ASTERISK_SOUNDS_DIR, { recursive: true });
      }
      fs.copyFileSync(src, dest);
      fs.chmodSync(dest, 0o666);
    } catch (e) {
      console.error(`[SOUNDS] Ошибка копирования ${file}:`, e.message);
    }
  });
}

function generateConfigs() {
  console.log('🚀 [BRIDGE] Генерация конфигураций Asterisk...');

  const extensions = readJSON(FILES.extensions);
  const trunks = readJSON(FILES.trunks);
  const queues = readJSON(FILES.queues);
  const ivrs = readJSON(FILES.ivrs);
  const routes = readJSON(FILES.routes);

  // 1. Абоненты (PJSIP)
  let usersConf = '';
  extensions.forEach(ext => {
    usersConf += `
[${ext.id}]
type=endpoint
context=${ext.context || 'from-internal'}
disallow=all
allow=ulaw,alaw,g722
auth=auth-${ext.id}
aors=${ext.id}
identify_by=auth_username,username
rtp_symmetric=yes
force_rport=yes
rewrite_contact=yes
direct_media=no

[auth-${ext.id}]
type=auth
auth_type=userpass
password=${ext.secret}
username=${ext.id}

[${ext.id}]
type=aor
max_contacts=5
remove_existing=yes
`;
  });
  fs.writeFileSync(OUTPUT_FILES.users, usersConf);

  // 2. Транки (PJSIP с Регистрацией)
  let trunksConf = '';
  trunks.forEach(t => {
    const trunkId = t.id || t.name;
    trunksConf += `
[registration-${trunkId}]
type=registration
transport=transport-udp-nat
endpoint=trunk-${trunkId}
server_uri=sip:${t.host}:${t.port}
client_uri=sip:${t.user}@${t.host}:${t.port}
contact_user=${t.user}
outbound_auth=auth-${trunkId}

[trunk-${trunkId}]
type=endpoint
context=from-trunk
disallow=all
allow=alaw,ulaw
outbound_auth=auth-${trunkId}
aors=aor-${trunkId}
identify_by=username

[auth-${trunkId}]
type=auth
auth_type=userpass
password=${t.password}
username=${t.user}

[aor-${trunkId}]
type=aor
contact=sip:${t.host}:${t.port}
`;
  });
  fs.writeFileSync(OUTPUT_FILES.trunks, trunksConf);

  // 3. Очереди
  let queuesConf = '';
  queues.forEach(q => {
    queuesConf += `
[${q.name}]
strategy=${q.strategy || 'ringall'}
timeout=${q.timeout || 15}
retry=${q.retry || 5}
wrapuptime=${q.wrapUpTime || 0}
musicclass=${q.musicOnHoldClass || 'default'}
announce-frequency=0
periodic-announce-frequency=0
`;
    (q.members || []).forEach(m => {
      queuesConf += `member => PJSIP/${m}\n`;
    });
  });
  fs.writeFileSync(OUTPUT_FILES.queues, queuesConf);

  // 4. Диалплан (Маршруты и IVR)
  let dialplan = `
[from-internal]
; Внутренние звонки
exten => _XXX,1,NoOp(Internal Call to $\{EXTEN\})
 same => n,Dial(PJSIP/$\{EXTEN\},30)
 same => n,Hangup()

; Исходящие маршруты
`;

  routes.filter(r => r.type === 'outbound').forEach(r => {
    const dest = r.destination.split(':');
    if (dest[0] === 'Trunk') {
      dialplan += `exten => ${r.pattern},1,NoOp(Outbound Call via ${dest[1]})
 same => n,Dial(PJSIP/$\{EXTEN\}@trunk-${dest[1]})
 same => n,Hangup()\n`;
    }
  });

  dialplan += `
[from-trunk]
; Входящий s (стандартный для многих провайдеров)
exten => s,1,NoOp(Incoming call on S extension)
`;
  
  const inboundRoutes = routes.filter(r => r.type === 'inbound');
  if (inboundRoutes.length > 0) {
    const firstRoute = inboundRoutes[0];
    const dest = firstRoute.destination.split(':');
    if (dest[0] === 'Extension') dialplan += ` same => n,Goto(from-internal,${dest[1]},1)\n`;
    if (dest[0] === 'Queue') dialplan += ` same => n,Queue(${dest[1]})\n`;
    if (dest[0] === 'IVR') dialplan += ` same => n,Goto(miac-ivr-${dest[1]},s,1)\n`;
  } else {
    dialplan += ` same => n,Hangup()\n`;
  }

  inboundRoutes.forEach(r => {
    const dest = r.destination.split(':');
    dialplan += `exten => ${r.pattern},1,NoOp(Inbound DID ${r.pattern})\n`;
    if (dest[0] === 'Extension') dialplan += ` same => n,Goto(from-internal,${dest[1]},1)\n`;
    if (dest[0] === 'Queue') dialplan += ` same => n,Queue(${dest[1]})\n`;
    if (dest[0] === 'IVR') dialplan += ` same => n,Goto(miac-ivr-${dest[1]},s,1)\n`;
  });

  // Генерация контекстов IVR
  ivrs.forEach(ivr => {
    dialplan += `
[miac-ivr-${ivr.id}]
exten => s,1,Answer()
 same => n,NoOp(Entering IVR: ${ivr.name})
 same => n,Background(${ivr.announcementFile})
 same => n,WaitExten(5)

`;
    (ivr.digitMappings || []).forEach(m => {
      const [digit, type, target] = m.split(':');
      if (type === 'ext') dialplan += `exten => ${digit},1,Goto(from-internal,${target},1)\n`;
      if (type === 'queue') dialplan += `exten => ${digit},1,Queue(${target})\n`;
      if (type === 'ivr') dialplan += `exten => ${digit},1,Goto(miac-ivr-${target},s,1)\n`;
    });
    dialplan += `exten => i,1,Playback(invalid)\n same => n,Goto(s,1)\n`;
    dialplan += `exten => t,1,Hangup()\n`;
  });

  fs.writeFileSync(OUTPUT_FILES.dialplan, dialplan);

  syncSounds();

  // Перезагрузка Asterisk
  exec('asterisk -rx "core reload"', (err) => {
    if (err) console.error('❌ [BRIDGE] Ошибка перезагрузки Asterisk:', err.message);
    else console.log('✅ [BRIDGE] Конфигурации применены!');
  });
}

// Следим за изменениями
console.log('👀 [BRIDGE] Запуск мониторинга данных...');
Object.values(FILES).forEach(file => {
  if (fs.existsSync(file)) {
    fs.watchFile(file, { interval: 1000 }, generateConfigs);
  }
});

// Следим за новыми звуками
fs.watch(SOUNDS_DIR, (eventType) => {
  if (eventType === 'rename') syncSounds();
});

generateConfigs();
