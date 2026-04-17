
import fs from 'fs';
import path from 'path';

/**
 * МИАЦ.СВЯЗЬ - Скрипт синхронизации данных с Asterisk 17/20
 * Генерирует конфиги PJSIP, Queues и Extensions на основе JSON базы.
 */

const DATA_DIR = path.join(process.cwd(), 'src/data');
const AST_DIR = '/etc/asterisk'; // В продакшене изменить на нужный путь

const FILES = {
  extensions: path.join(DATA_DIR, 'extensions.json'),
  trunks: path.join(DATA_DIR, 'trunks.json'),
  routes: path.join(DATA_DIR, 'routes.json'),
  queues: path.join(DATA_DIR, 'queues.json'),
  ivrs: path.join(DATA_DIR, 'ivrs.json'),
};

const CONF_OUTPUT = {
  users: path.join(AST_DIR, 'pjsip_miac_users.conf'),
  trunks: path.join(AST_DIR, 'pjsip_miac_trunks.conf'),
  queues: path.join(AST_DIR, 'queues_miac.conf'),
  dialplan: path.join(AST_DIR, 'extensions_miac_dialplan.conf'),
};

function readJSON(file) {
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return [];
  }
}

function generateConfigs() {
  console.log(`[${new Date().toLocaleTimeString()}] Синхронизация с Asterisk...`);

  const extensions = readJSON(FILES.extensions);
  const trunks = readJSON(FILES.trunks);
  const routes = readJSON(FILES.routes);
  const queues = readJSON(FILES.queues);
  const ivrs = readJSON(FILES.ivrs);

  // 1. ГЕНЕРАЦИЯ АБОНЕНТОВ (PJSIP)
  let usersConf = '';
  extensions.forEach(ext => {
    usersConf += `
[${ext.id}]
type=endpoint
context=from-internal
disallow=all
allow=ulaw,alaw
auth=auth-${ext.id}
aors=${ext.id}
rtp_symmetric=yes
force_rport=yes
rewrite_contact=yes
direct_media=no
language=ru
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

  // 2. ГЕНЕРАЦИЯ ТРАНКОВ (PJSIP + IDENTIFY)
  let trunksConf = '';
  trunks.forEach(t => {
    const trunkId = t.id || t.name.toLowerCase().replace(/\s+/g, '-');
    trunksConf += `
[registration-${trunkId}]
type=registration
server_uri=sip:${t.host}:${t.port}
client_uri=sip:${t.user}@${t.host}:${t.port}
contact_user=${t.user}
retry_interval=60
auth_rejection_permanent=no
outbound_auth=auth-${trunkId}

[auth-${trunkId}]
type=auth
auth_type=userpass
password=${t.password}
username=${t.user}

[${trunkId}]
type=aor
contact=sip:${t.host}:${t.port}

[${trunkId}]
type=endpoint
context=from-trunk
disallow=all
allow=ulaw,alaw
outbound_auth=auth-${trunkId}
aors=${trunkId}
direct_media=no
identify_by=username,auth_username

[identify-${trunkId}]
type=identify
endpoint=${trunkId}
match=${t.host}
`;
  });

  // 3. ГЕНЕРАЦИЯ ОЧЕРЕДЕЙ
  let queuesConf = '';
  queues.forEach(q => {
    queuesConf += `
[${q.name}]
strategy=${q.strategy || 'ringall'}
timeout=${q.timeout || 15}
retry=5
wrapuptime=0
maxlen=0
musicclass=${q.musicOnHoldClass || 'default'}
announce-frequency=0
periodic-announce-frequency=0
`;
    (q.members || []).forEach(m => {
      queuesConf += `member => PJSIP/${m}\n`;
    });
  });

  // 4. ГЕНЕРАЦИЯ DIALPLAN (Маршруты + IVR)
  let dialplanConf = '[from-internal]\n';
  
  // Внутренние звонки
  extensions.forEach(ext => {
    dialplanConf += `exten => ${ext.id},1,Dial(PJSIP/${ext.id},30)\n`;
    dialplanConf += `same => n,Hangup()\n`;
  });

  // Исходящие маршруты
  routes.filter(r => r.type === 'outbound').forEach(r => {
    const trunkId = r.destination.replace('Trunk:', '');
    dialplanConf += `exten => _${r.pattern},1,NoOp(Outbound Call via ${trunkId})\n`;
    dialplanConf += `same => n,Dial(PJSIP/\${EXTEN}@${trunkId})\n`;
    dialplanConf += `same => n,Hangup()\n`;
  });

  // Входящие маршруты
  dialplanConf += '\n[from-trunk]\n';
  dialplanConf += `exten => s,1,NoOp(Inbound Call on Standard extension S)\n`;
  
  const inboundRoutes = routes.filter(r => r.type === 'inbound');
  inboundRoutes.forEach((r, idx) => {
    const priority = idx === 0 ? 1 : 'n';
    let dest = '';
    if (r.destination.startsWith('Extension:')) {
      dest = `Dial(PJSIP/${r.destination.split(':')[1]},30)`;
    } else if (r.destination.startsWith('Queue:')) {
      dest = `Queue(${r.destination.split(':')[1]})`;
    } else if (r.destination.startsWith('IVR:')) {
      dest = `Goto(miac-ivr-${r.destination.split(':')[1]},s,1)`;
    }
    
    dialplanConf += `exten => ${r.pattern},1,NoOp(Inbound DID ${r.pattern})\n`;
    dialplanConf += `same => n,${dest}\n`;
    
    // Если это первый входящий маршрут, привязываем к нему и 's'
    if (idx === 0) {
      dialplanConf += `exten => s,n,Goto(${r.pattern},1)\n`;
    }
  });

  // ГЕНЕРАЦИЯ КОНТЕКСТОВ IVR
  ivrs.forEach(ivr => {
    dialplanConf += `\n[miac-ivr-${ivr.id}]\n`;
    dialplanConf += `exten => s,1,Answer()\n`;
    dialplanConf += `same => n,NoOp(Entering IVR: ${ivr.name})\n`;
    dialplanConf += `same => n,Background(ru/${ivr.announcementFile})\n`;
    dialplanConf += `same => n,WaitExten(5)\n`;
    
    // Кнопки
    (ivr.digitMappings || []).forEach(mapping => {
      const [digit, type, target] = mapping.split(':');
      let cmd = '';
      if (type === 'ext') cmd = `Dial(PJSIP/${target},30)`;
      else if (type === 'queue') cmd = `Queue(${target})`;
      else if (type === 'ivr') cmd = `Goto(miac-ivr-${target},s,1)`;
      
      dialplanConf += `exten => ${digit},1,NoOp(IVR ${ivr.name}: Digit ${digit})\n`;
      dialplanConf += `same => n,${cmd}\n`;
    });

    // Таймаут
    if (ivr.timeoutDestination) {
      const [type, target] = ivr.timeoutDestination.split(':');
      let tCmd = 'Hangup()';
      if (type === 'Extension') tCmd = `Dial(PJSIP/${target},30)`;
      else if (type === 'Queue') tCmd = `Queue(${target})`;
      
      dialplanConf += `exten => t,1,NoOp(IVR ${ivr.name}: Timeout, redirecting to ${target})\n`;
      dialplanConf += `same => n,${tCmd}\n`;
    } else {
      dialplanConf += `exten => t,1,Hangup()\n`;
    }
    
    dialplanConf += `exten => i,1,Playback(invalid)\n`;
    dialplanConf += `same => n,Goto(s,1)\n`;
  });

  // ЗАПИСЬ ФАЙЛОВ
  try {
    fs.writeFileSync(CONF_OUTPUT.users, usersConf);
    fs.writeFileSync(CONF_OUTPUT.trunks, trunksConf);
    fs.writeFileSync(CONF_OUTPUT.queues, queuesConf);
    fs.writeFileSync(CONF_OUTPUT.dialplan, dialplanConf);
    console.log('[OK] Конфигурации успешно обновлены.');
  } catch (err) {
    console.error('[ERROR] Ошибка записи конфигов:', err.message);
  }
}

// Запуск при старте и наблюдение за изменениями
generateConfigs();
fs.watch(DATA_DIR, (event, filename) => {
  if (filename && filename.endsWith('.json')) {
    generateConfigs();
  }
});
