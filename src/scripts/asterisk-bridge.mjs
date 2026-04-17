
import fs from 'fs';
import path from 'path';

// Пути к файлам данных приложения
const DATA_DIR = path.join(process.cwd(), 'src/data');
const SOUNDS_DIR = path.join(process.cwd(), 'src/data/sounds');

// Пути к конфигам Asterisk (должны быть доступны на запись)
const ASTERISK_CONF_DIR = '/etc/asterisk';
const CONF_FILES = {
  users: path.join(ASTERISK_CONF_DIR, 'pjsip_miac_users.conf'),
  trunks: path.join(ASTERISK_CONF_DIR, 'pjsip_miac_trunks.conf'),
  queues: path.join(ASTERISK_CONF_DIR, 'queues_miac.conf'),
  dialplan: path.join(ASTERISK_CONF_DIR, 'extensions_miac_dialplan.conf'),
};

function readJSON(filename) {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function sync() {
  console.log(`[${new Date().toLocaleTimeString()}] Синхронизация с Asterisk...`);

  const extensions = readJSON('extensions.json');
  const trunks = readJSON('trunks.json');
  const routes = readJSON('routes.json');
  const queues = readJSON('queues.json');
  const ivrs = readJSON('ivrs.json');

  // 1. ГЕНЕРАЦИЯ АБОНЕНТОВ (PJSIP)
  let usersConfig = '';
  extensions.forEach(ext => {
    usersConfig += `
[${ext.id}]
type=endpoint
context=from-internal
disallow=all
allow=ulaw,alaw
auth=auth-${ext.id}
aors=${ext.id}
identify_by=auth_username,username

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

  // 2. ГЕНЕРАЦИЯ ТРАНКОВ (PJSIP)
  let trunksConfig = '';
  trunks.forEach(t => {
    trunksConfig += `
[registration-${t.id}]
type=registration
outbound_auth=auth-${t.id}
server_uri=sip:${t.host}:${t.port}
client_uri=sip:${t.user}@${t.host}:${t.port}
retry_interval=60

[auth-${t.id}]
type=auth
auth_type=userpass
password=${t.password}
username=${t.user}

[trunk-${t.id}]
type=aor
contact=sip:${t.host}:${t.port}

[trunk-${t.id}]
type=endpoint
context=from-trunk
disallow=all
allow=ulaw,alaw
outbound_auth=auth-${t.id}
aors=trunk-${t.id}

[identify-${t.id}]
type=identify
endpoint=trunk-${t.id}
match=${t.host}
`;
  });

  // 3. ГЕНЕРАЦИЯ ОЧЕРЕДЕЙ (QUEUES)
  let queuesConfig = '';
  queues.forEach(q => {
    queuesConfig += `
[${q.name}]
strategy=${q.strategy || 'ringall'}
timeout=${q.timeout || 15}
retry=5
wrapuptime=0
musicclass=${q.musicOnHoldClass || 'default'}
announce-frequency=0
announce-holdtime=no
`;
    (q.members || []).forEach(m => {
      queuesConfig += `member => PJSIP/${m}\n`;
    });
    queuesConfig += '\n';
  });

  // 4. ГЕНЕРАЦИЯ DIALPLAN (EXTENSIONS)
  let dialplanConfig = `
[from-internal]
exten => _X.,1,NoOp(Internal call from $\{CALLERID(num)\} to $\{EXTEN\})
`;

  // Внутренние номера
  extensions.forEach(ext => {
    dialplanConfig += `exten => ${ext.id},1,Dial(PJSIP/${ext.id},30)\n`;
    dialplanConfig += `same => n,Hangup()\n`;
  });

  // Исходящие маршруты
  routes.filter(r => r.type === 'outbound').forEach(r => {
    const trunkId = r.destination.replace('Trunk:', '');
    dialplanConfig += `exten => ${r.pattern},1,NoOp(Outbound call to $\{EXTEN\} via ${trunkId})\n`;
    dialplanConfig += `same => n,Dial(PJSIP/$\{EXTEN\}@trunk-${trunkId})\n`;
    dialplanConfig += `same => n,Hangup()\n`;
  });

  // Входящий контекст (from-trunk) согласно инструкции
  dialplanConfig += `
[from-trunk]
exten => s,1,NoOp(Incoming call to "s" from $\{CALLERID(num)\})
`;

  // Ищем маршруты для входящих звонков
  const inboundRoutes = routes.filter(r => r.type === 'inbound');
  
  // Если есть маршрут с шаблоном "*" или пустой - это наш "s"
  const defaultRoute = inboundRoutes.find(r => r.pattern === '*' || !r.pattern);
  if (defaultRoute) {
    const dest = defaultRoute.destination;
    if (dest.startsWith('IVR:')) {
      dialplanConfig += `same => n,Goto(miac-ivr-${dest.replace('IVR:', '')},s,1)\n`;
    } else if (dest.startsWith('Extension:')) {
      dialplanConfig += `same => n,Dial(PJSIP/${dest.replace('Extension:', '')},30)\n`;
    } else if (dest.startsWith('Queue:')) {
      dialplanConfig += `same => n,Queue(${dest.replace('Queue:', '')})\n`;
    }
  } else {
    dialplanConfig += `same => n,Hangup()\n`;
  }

  // Конкретные DID маршруты
  inboundRoutes.filter(r => r.pattern && r.pattern !== '*').forEach(r => {
    dialplanConfig += `exten => ${r.pattern},1,NoOp(Inbound call for DID ${r.pattern})\n`;
    const dest = r.destination;
    if (dest.startsWith('IVR:')) {
      dialplanConfig += `same => n,Goto(miac-ivr-${dest.replace('IVR:', '')},s,1)\n`;
    } else if (dest.startsWith('Extension:')) {
      dialplanConfig += `same => n,Dial(PJSIP/${dest.replace('Extension:', '')},30)\n`;
    } else if (dest.startsWith('Queue:')) {
      dialplanConfig += `same => n,Queue(${dest.replace('Queue:', '')})\n`;
    }
    dialplanConfig += `same => n,Hangup()\n`;
  });

  // Секции IVR
  ivrs.forEach(ivr => {
    dialplanConfig += `
[miac-ivr-${ivr.id}]
exten => s,1,Answer()
same => n,Wait(1)
same => n,NoOp(Entering IVR: ${ivr.name})
same => n,Background(${ivr.announcementFile})
same => n,WaitExten(5)

; Timeout handler
exten => t,1,NoOp(IVR Timeout)
`;
    if (ivr.timeoutDestination) {
      const dest = ivr.timeoutDestination;
      if (dest.startsWith('Extension:')) {
        dialplanConfig += `same => n,Dial(PJSIP/${dest.replace('Extension:', '')},30)\n`;
      } else if (dest.startsWith('Queue:')) {
        dialplanConfig += `same => n,Queue(${dest.replace('Queue:', '')})\n`;
      } else {
        dialplanConfig += `same => n,Hangup()\n`;
      }
    } else {
      dialplanConfig += `same => n,Hangup()\n`;
    }

    // Обработка кнопок
    (ivr.digitMappings || []).forEach(mapping => {
      const [digit, type, target] = mapping.split(':');
      if (digit && target) {
        if (type === 'ext') {
          dialplanConfig += `exten => ${digit},1,Dial(PJSIP/${target},30)\n`;
        } else if (type === 'queue') {
          dialplanConfig += `exten => ${digit},1,Queue(${target})\n`;
        } else if (type === 'ivr') {
          dialplanConfig += `exten => ${digit},1,Goto(miac-ivr-${target},s,1)\n`;
        }
        dialplanConfig += `same => n,Hangup()\n`;
      }
    });

    dialplanConfig += `
; Invalid input handler
exten => i,1,NoOp(IVR Invalid Input)
same => n,Playback(pbx-invalid)
same => n,Goto(s,1)
`;
  });

  // Сохранение файлов
  try {
    fs.writeFileSync(CONF_FILES.users, usersConfig);
    fs.writeFileSync(CONF_FILES.trunks, trunksConfig);
    fs.writeFileSync(CONF_FILES.queues, queuesConfig);
    fs.writeFileSync(CONF_FILES.dialplan, dialplanConfig);

    // Копирование звуков в системную папку Asterisk (если есть права)
    if (fs.existsSync(SOUNDS_DIR)) {
      const files = fs.readdirSync(SOUNDS_DIR);
      files.forEach(file => {
        const src = path.join(SOUNDS_DIR, file);
        const dest = path.join('/var/lib/asterisk/sounds', file);
        try {
          fs.copyFileSync(src, dest);
        } catch (e) {
          // Игнорируем ошибки прав доступа, если мы не под root
        }
      });
    }

    console.log('[OK] Конфигурация успешно обновлена.');
    console.log('Для применения выполните: asterisk -rx "core reload"');
  } catch (err) {
    console.error('[ERROR] Ошибка записи файлов Asterisk:', err.message);
  }
}

// Запуск синхронизации
sync();
// Опционально: запуск каждые 30 секунд
setInterval(sync, 30000);
