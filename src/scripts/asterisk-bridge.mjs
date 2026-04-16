
import fs from 'fs';
import path from 'path';
import asteriskManager from 'asterisk-manager';
import { execSync } from 'child_process';

// Конфигурация путей
const DATA_DIR = path.join(process.cwd(), 'src/data');
const SOUNDS_DIR = path.join(DATA_DIR, 'sounds');
const ASTERISK_CONF_DIR = '/etc/asterisk';
const ASTERISK_SOUNDS_DIR = '/var/lib/asterisk/sounds';

// AMI Настройки
const ami = asteriskManager(5038, '127.0.0.1', 'miac', 'MiacAMI2026', true);

console.log('🚀 [BRIDGE] Мост МИАЦ.СВЯЗЬ запущен...');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

ensureDir(SOUNDS_DIR);

function readJSON(filename) {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf8') || '[]');
}

async function syncToAsterisk() {
  console.log('🔄 [BRIDGE] Начало синхронизации...');

  try {
    const extensions = readJSON('extensions.json');
    const trunks = readJSON('trunks.json');
    const routes = readJSON('routes.json');
    const queues = readJSON('queues.json');
    const ivrs = readJSON('ivrs.json');

    // 1. Генерация Абонентов
    let pjsipContent = '; Генерируемый файл пользователей МИАЦ.СВЯЗЬ\n';
    extensions.forEach(ext => {
      pjsipContent += `
[${ext.id}]
type=endpoint
context=${ext.context || 'from-internal'}
disallow=all
allow=ulaw,alaw,g722
auth=${ext.id}
aors=${ext.id}
transport=transport-udp-nat

[${ext.id}]
type=auth
auth_type=userpass
username=${ext.id}
password=${ext.secret}

[${ext.id}]
type=aor
max_contacts=1
remove_existing=yes
`;
    });
    fs.writeFileSync(path.join(ASTERISK_CONF_DIR, 'pjsip_miac_users.conf'), pjsipContent);

    // 2. Генерация Транков
    let trunksContent = '; Генерируемый файл транков МИАЦ.СВЯЗЬ\n';
    trunks.forEach(t => {
      const trunkId = t.id || t.name;
      trunksContent += `
[${trunkId}-reg]
type=registration
transport=transport-udp-nat
outbound_auth=${trunkId}-auth
server_uri=sip:${t.host}:${t.port || 5060}
client_uri=sip:${t.user}@${t.host}:${t.port || 5060}
retry_interval=60

[${trunkId}-auth]
type=auth
auth_type=userpass
username=${t.user}
password=${t.password}

[${trunkId}]
type=endpoint
transport=transport-udp-nat
context=from-trunk
disallow=all
allow=ulaw,alaw
outbound_auth=${trunkId}-auth
aors=${trunkId}-aor

[${trunkId}-aor]
type=aor
contact=sip:${t.host}:${t.port || 5060}

[${trunkId}-id]
type=identify
endpoint=${trunkId}
match=${t.host}
`;
    });
    fs.writeFileSync(path.join(ASTERISK_CONF_DIR, 'pjsip_miac_trunks.conf'), trunksContent);

    // 3. Генерация Очередей
    let queuesContent = '; Генерируемый файл очередей МИАЦ.СВЯЗЬ\n';
    queues.forEach(q => {
      queuesContent += `
[${q.name}]
musicclass=${q.musicOnHoldClass || 'default'}
strategy=${q.strategy || 'ringall'}
timeout=15
retry=5
wrapuptime=0
maxlen=0
announce-frequency=0
announce-holdtime=no
joinempty=yes
leavewhenempty=no
`;
      (q.members || []).forEach(m => {
        queuesContent += `member => PJSIP/${m}\n`;
      });
    });
    fs.writeFileSync(path.join(ASTERISK_CONF_DIR, 'queues_miac.conf'), queuesContent);

    // 4. Генерация Диалплана
    let dialplan = `
[from-internal]
; Внутренние звонки
exten => _XXX,1,NoOp(Internal call to \${EXTEN})
 same => n,Dial(PJSIP/\${EXTEN},20)
 same => n,VoiceMail(\${EXTEN}@default,u)
 same => n,Hangup()

; Исходящие маршруты
`;
    routes.filter(r => r.type === 'outbound').forEach(r => {
      const trunkName = r.destination.split(':')[1];
      dialplan += `exten => ${r.pattern},1,Dial(PJSIP/\${EXTEN}@${trunkName})\n`;
    });

    // Входящие маршруты и IVR
    dialplan += `\n[from-trunk]\n`;
    routes.filter(r => r.type === 'inbound').forEach(r => {
      const [destType, destId] = r.destination.split(':');
      if (destType === 'Extension') dialplan += `exten => ${r.pattern},1,Dial(PJSIP/${destId})\n`;
      if (destType === 'Queue') dialplan += `exten => ${r.pattern},1,Queue(${destId})\n`;
      if (destType === 'IVR') dialplan += `exten => ${r.pattern},1,Goto(ivr-${destId},s,1)\n`;
    });

    // Секции IVR
    ivrs.forEach(ivr => {
      dialplan += `\n[ivr-${ivr.id}]\n`;
      dialplan += `exten => s,1,Answer()\n`;
      dialplan += ` same => n,Background(${ivr.announcementFile})\n`;
      dialplan += ` same => n,WaitExten(5)\n`;
      
      (ivr.digitMappings || []).forEach(m => {
        const [digit, type, target] = m.split(':');
        if (type === 'ext') dialplan += `exten => ${digit},1,Dial(PJSIP/${target})\n`;
        if (type === 'queue') dialplan += `exten => ${digit},1,Queue(${target})\n`;
        if (type === 'ivr') dialplan += `exten => ${digit},1,Goto(ivr-${target},s,1)\n`;
      });
      dialplan += `exten => t,1,Hangup()\n`;
      dialplan += `exten => i,1,Playback(invalid)\n`;
      dialplan += ` same => n,Goto(s,1)\n`;
    });

    fs.writeFileSync(path.join(ASTERISK_CONF_DIR, 'extensions_miac_dialplan.conf'), dialplan);

    // 5. Синхронизация звуков
    if (fs.existsSync(SOUNDS_DIR)) {
      const files = fs.readdirSync(SOUNDS_DIR);
      files.forEach(file => {
        const src = path.join(SOUNDS_DIR, file);
        const dest = path.join(ASTERISK_SOUNDS_DIR, file);
        try {
          fs.copyFileSync(src, dest);
          fs.chmodSync(dest, 0o666);
        } catch (e) {
          console.error(`⚠️ [BRIDGE] Ошибка копирования звука ${file}:`, e.message);
        }
      });
    }

    // 6. Перезагрузка Asterisk через AMI
    const commands = [
      'module reload res_pjsip.so',
      'module reload app_queue.so',
      'dialplan reload'
    ];

    for (const cmd of commands) {
      ami.action({ action: 'Command', command: cmd }, (err, res) => {
        if (err) console.error(`❌ [BRIDGE] AMI Error (${cmd}):`, err);
        else console.log(`✅ [BRIDGE] Asterisk Command (${cmd}): OK`);
      });
    }

  } catch (err) {
    console.error('❌ [BRIDGE] Ошибка синхронизации:', err);
  }
}

// Следим за изменениями в JSON файлах
fs.watch(DATA_DIR, (eventType, filename) => {
  if (filename && filename.endsWith('.json')) {
    syncToAsterisk();
  }
});

// Следим за новыми звуками
fs.watch(SOUNDS_DIR, (eventType, filename) => {
  if (filename) syncToAsterisk();
});

// Первая синхронизация при запуске
syncToAsterisk();
