import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

const DATA_DIR = path.join(process.cwd(), 'src/data');
const SOUNDS_DIR = path.join(process.cwd(), 'src/data/sounds');
const ASTERISK_CONF_DIR = '/etc/asterisk';
const ASTERISK_SOUNDS_DIR = '/var/lib/asterisk/sounds';

const FILES = {
  extensions: path.join(DATA_DIR, 'extensions.json'),
  trunks: path.join(DATA_DIR, 'trunks.json'),
  routes: path.join(DATA_DIR, 'routes.json'),
  queues: path.join(DATA_DIR, 'queues.json'),
  ivrs: path.join(DATA_DIR, 'ivrs.json'),
};

const AST_OUTPUTS = {
  pjsip_users: path.join(ASTERISK_CONF_DIR, 'pjsip_miac_users.conf'),
  pjsip_trunks: path.join(ASTERISK_CONF_DIR, 'pjsip_miac_trunks.conf'),
  extensions: path.join(ASTERISK_CONF_DIR, 'extensions_miac_dialplan.conf'),
  queues: path.join(ASTERISK_CONF_DIR, 'queues_miac.conf'),
};

// Создаем папки если их нет
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(SOUNDS_DIR)) fs.mkdirSync(SOUNDS_DIR, { recursive: true });

async function reloadAsterisk(module = 'all') {
  try {
    if (module === 'pjsip') await execPromise('asterisk -rx "pjsip reload"');
    else if (module === 'dialplan') await execPromise('asterisk -rx "dialplan reload"');
    else if (module === 'queues') await execPromise('asterisk -rx "queue reload all"');
    else await execPromise('asterisk -rx "core reload"');
    console.log(`[ASTERISK] Перезагрузка ${module} выполнена.`);
  } catch (e) {
    console.error(`[ASTERISK] Ошибка перезагрузки ${module}: ${e.message}`);
  }
}

function generateConfigs() {
  console.log('[BRIDGE] Генерация конфигураций Asterisk...');

  // 1. PJSIP USERS
  const exts = JSON.parse(fs.readFileSync(FILES.extensions, 'utf8') || '[]');
  let pjsipUsersContent = '; Генерируемый файл пользователей МИАЦ.СВЯЗЬ\n';
  exts.forEach(e => {
    pjsipUsersContent += `
[${e.id}]
type=endpoint
context=from-internal
disallow=all
allow=ulaw,alaw,g722
auth=auth${e.id}
aors=${e.id}
identify_by=username
rtp_symmetric=yes
force_rport=yes
rewrite_contact=yes
direct_media=no

[auth${e.id}]
type=auth
auth_type=userpass
password=${e.secret}
username=${e.id}

[${e.id}]
type=aor
max_contacts=1
remove_existing=yes
`;
  });
  fs.writeFileSync(AST_OUTPUTS.pjsip_users, pjsipUsersContent);

  // 2. PJSIP TRUNKS
  const trunks = JSON.parse(fs.readFileSync(FILES.trunks, 'utf8') || '[]');
  let pjsipTrunksContent = '; Генерируемый файл транков МИАЦ.СВЯЗЬ\n';
  trunks.forEach(t => {
    pjsipTrunksContent += `
[registration-${t.id}]
type=registration
transport=transport-udp
outbound_auth=auth-${t.id}
server_uri=sip:${t.host}:${t.port}
client_uri=sip:${t.user}@${t.host}:${t.port}
retry_interval=60

[auth-${t.id}]
type=auth
auth_type=userpass
password=${t.password}
username=${t.user}

[${t.id}]
type=aor
contact=sip:${t.host}:${t.port}

[${t.id}]
type=endpoint
context=from-trunk
disallow=all
allow=ulaw,alaw
outbound_auth=auth-${t.id}
aors=${t.id}
from_user=${t.user}
from_domain=${t.host}
identify_by=username
`;
  });
  fs.writeFileSync(AST_OUTPUTS.pjsip_trunks, pjsipTrunksContent);

  // 3. QUEUES
  const queues = JSON.parse(fs.readFileSync(FILES.queues, 'utf8') || '[]');
  let queuesContent = '; Генерируемый файл очередей МИАЦ.СВЯЗЬ\n';
  queues.forEach(q => {
    queuesContent += `
[${q.name}]
strategy=${q.strategy}
musicclass=${q.musicOnHoldClass || 'default'}
timeout=15
retry=5
wrapuptime=0
`;
    (q.members || []).forEach(m => {
      queuesContent += `member => PJSIP/${m}\n`;
    });
  });
  fs.writeFileSync(AST_OUTPUTS.queues, queuesContent);

  // 4. DIALPLAN (Extensions)
  const routes = JSON.parse(fs.readFileSync(FILES.routes, 'utf8') || '[]');
  const ivrs = JSON.parse(fs.readFileSync(FILES.ivrs, 'utf8') || '[]');
  
  let dialplanContent = `
[from-internal]
; Внутренняя связь (автоматически)
exten => _XXX,1,Dial(PJSIP/\${EXTEN},30)
same => n,Hangup()

; Исходящие маршруты
`;

  routes.filter(r => r.type === 'outbound').forEach(r => {
    const trunkId = r.destination.split(':')[1];
    dialplanContent += `exten => ${r.pattern},1,Dial(PJSIP/\${EXTEN}@${trunkId})\n`;
  });

  dialplanContent += `
[from-trunk]
; Входящие маршруты
`;
  routes.filter(r => r.type === 'inbound').forEach(r => {
    const [destType, destId] = r.destination.split(':');
    if (destType === 'Extension') {
      dialplanContent += `exten => ${r.pattern},1,Dial(PJSIP/${destId},30)\n`;
    } else if (destType === 'Queue') {
      dialplanContent += `exten => ${r.pattern},1,Queue(${destId})\n`;
    } else if (destType === 'IVR') {
      dialplanContent += `exten => ${r.pattern},1,Goto(ivr-${destId},s,1)\n`;
    }
  });

  // IVR Contexts
  ivrs.forEach(ivr => {
    dialplanContent += `
[ivr-${ivr.id}]
exten => s,1,Answer()
same => n,Background(${ivr.announcementFile})
same => n,WaitExten(5)

`;
    (ivr.digitMappings || []).forEach(m => {
      const [digit, type, target] = m.split(':');
      if (type === 'ext') dialplanContent += `exten => ${digit},1,Dial(PJSIP/${target},30)\n`;
      else if (type === 'queue') dialplanContent += `exten => ${digit},1,Queue(${target})\n`;
      else if (type === 'ivr') dialplanContent += `exten => ${digit},1,Goto(ivr-${target},s,1)\n`;
    });
    dialplanContent += `exten => t,1,Hangup()\nexten => i,1,Playback(invalid)\n`;
  });

  fs.writeFileSync(AST_OUTPUTS.extensions, dialplanContent);

  reloadAsterisk();
}

// Следим за изменениями в JSON
Object.values(FILES).forEach(file => {
  fs.watchFile(file, () => {
    console.log(`[BRIDGE] Файл ${path.basename(file)} изменен.`);
    generateConfigs();
  });
});

// Следим за новыми звуками
fs.watch(SOUNDS_DIR, (event, filename) => {
  if (filename) {
    const src = path.join(SOUNDS_DIR, filename);
    const dest = path.join(ASTERISK_SOUNDS_DIR, filename);
    if (fs.existsSync(src)) {
       try {
         fs.copyFileSync(src, dest);
         fs.chmodSync(dest, 0o666);
         console.log(`[BRIDGE] Звуковой файл ${filename} скопирован в Asterisk.`);
       } catch (e) {
         console.error(`[BRIDGE] Ошибка копирования звука: ${e.message}`);
       }
    }
  }
});

console.log('🚀 [BRIDGE] Мост МИАЦ.СВЯЗЬ запущен и готов к работе...');
generateConfigs();
