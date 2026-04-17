
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const DATA_DIR = path.join(process.cwd(), 'src/data');
const AST_CONF_DIR = '/etc/asterisk';

const FILES = {
  exts: path.join(DATA_DIR, 'extensions.json'),
  trunks: path.join(DATA_DIR, 'trunks.json'),
  routes: path.join(DATA_DIR, 'routes.json'),
  queues: path.join(DATA_DIR, 'queues.json'),
  ivrs: path.join(DATA_DIR, 'ivrs.json'),
  sounds: path.join(DATA_DIR, 'sounds'),
};

const AST_FILES = {
  users: path.join(AST_CONF_DIR, 'pjsip_miac_users.conf'),
  trunks: path.join(AST_CONF_DIR, 'pjsip_miac_trunks.conf'),
  queues: path.join(AST_CONF_DIR, 'queues_miac.conf'),
  dialplan: path.join(AST_CONF_DIR, 'extensions_miac_dialplan.conf'),
  sounds: '/var/lib/asterisk/sounds/miac',
};

function read(file) {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeConf(file, content) {
  try {
    fs.writeFileSync(file, content);
    console.log(`[OK] Created ${file}`);
  } catch (e) {
    console.error(`[ERR] Failed to write ${file}: ${e.message}`);
  }
}

console.log('--- МИАЦ.СВЯЗЬ: Синхронизация Asterisk ---');

// 1. Абоненты (PJSIP Users)
const extensions = read(FILES.exts);
let usersConf = '; Генерируемый файл абонентов\n\n';
extensions.forEach(e => {
  usersConf += `[${e.id}]\ntype=endpoint\ncontext=miac-internal\ndisallow=all\nallow=ulaw,alaw\nauth=auth${e.id}\naors=${e.id}\n\n`;
  usersConf += `[auth${e.id}]\ntype=auth\nauth_type=userpass\nusername=${e.id}\npassword=${e.secret}\n\n`;
  usersConf += `[${e.id}]\ntype=aor\nmax_contacts=1\n\n`;
});
writeConf(AST_FILES.users, usersConf);

// 2. Транки (PJSIP Trunks)
const trunks = read(FILES.trunks);
let trunksConf = '; Генерируемый файл транков\n\n';
trunks.forEach(t => {
  trunksConf += `[trunk-${t.id}]\ntype=endpoint\ncontext=from-trunk\ndisallow=all\nallow=ulaw,alaw\noutbound_auth=auth-${t.id}\naors=aor-${t.id}\n\n`;
  trunksConf += `[auth-${t.id}]\ntype=auth\nauth_type=userpass\nusername=${t.user}\npassword=${t.password}\n\n`;
  trunksConf += `[aor-${t.id}]\ntype=aor\ncontact=sip:${t.host}:${t.port}\n\n`;
  trunksConf += `[reg-${t.id}]\ntype=registration\noutbound_auth=auth-${t.id}\nserver_uri=sip:${t.host}:${t.port}\nclient_uri=sip:${t.user}@${t.host}:${t.port}\nretry_interval=60\nexpiration=120\n\n`;
  trunksConf += `[identify-${t.id}]\ntype=identify\nendpoint=trunk-${t.id}\nmatch=${t.host}\n\n`;
});
writeConf(AST_FILES.trunks, trunksConf);

// 3. Очереди (Queues)
const queues = read(FILES.queues);
let queuesConf = '; Генерируемый файл очередей\n\n';
queues.forEach(q => {
  queuesConf += `[${q.name}]\nstrategy=${q.strategy}\nmusicclass=${q.musicOnHoldClass || 'default'}\n`;
  (q.members || []).forEach(m => {
    queuesConf += `member => PJSIP/${m}\n`;
  });
  queuesConf += '\n';
});
writeConf(AST_FILES.queues, queuesConf);

// 4. Диалплан (Routes + IVR)
const routes = read(FILES.routes);
const ivrs = read(FILES.ivrs);

let dpConf = '[miac-internal]\n';
// Внутренние звонки
dpConf += 'exten => _XXX,1,Dial(PJSIP/${EXTEN},30)\n';
dpConf += 'same => n,Hangup()\n\n';

// Исходящие маршруты
routes.filter(r => r.type === 'outbound').forEach(r => {
  const trunkId = r.destination.replace('Trunk:', '');
  dpConf += `exten => ${r.pattern},1,Dial(PJSIP/\${EXTEN}@trunk-${trunkId})\n`;
  dpConf += `same => n,Hangup()\n`;
});

// Входящие маршруты
dpConf += '\n[from-trunk]\n';
routes.filter(r => r.type === 'inbound').forEach(r => {
  const target = r.destination;
  let cmd = '';
  if (target.startsWith('IVR:')) cmd = `Goto(miac-ivr-${target.split(':')[1]},s,1)`;
  else if (target.startsWith('Queue:')) cmd = `Queue(${target.split(':')[1]})`;
  else if (target.startsWith('Extension:')) cmd = `Dial(PJSIP/${target.split(':')[1]},30)`;

  if (r.pattern === '*') {
    dpConf += `exten => s,1,${cmd}\n`;
    dpConf += `exten => _.,1,${cmd}\n`;
  } else {
    dpConf += `exten => ${r.pattern},1,${cmd}\n`;
  }
});

// IVR Меню
ivrs.forEach(ivr => {
  dpConf += `\n[miac-ivr-${ivr.id}]\n`;
  dpConf += `exten => s,1,Answer()\n`;
  dpConf += `same => n,Progress()\n`;
  dpConf += `same => n,Wait(1)\n`;
  dpConf += `same => n,Background(miac/${ivr.announcementFile})\n`;
  dpConf += `same => n,WaitExten(5)\n`;
  
  // Таймаут
  if (ivr.timeoutDestination) {
    const [type, val] = ivr.timeoutDestination.split(':');
    let tCmd = 'Hangup()';
    if (type === 'Extension') tCmd = `Dial(PJSIP/${val},30)`;
    else if (type === 'Queue') tCmd = `Queue(${val})`;
    dpConf += `exten => t,1,${tCmd}\n`;
  } else {
    dpConf += `exten => t,1,Hangup()\n`;
  }

  // Кнопки
  (ivr.digitMappings || []).forEach(m => {
    const [digit, type, target] = m.split(':');
    let bCmd = 'Hangup()';
    if (type === 'ext') bCmd = `Dial(PJSIP/${target},30)`;
    else if (type === 'queue') bCmd = `Queue(${target})`;
    else if (type === 'ivr') bCmd = `Goto(miac-ivr-${target},s,1)`;
    dpConf += `exten => ${digit},1,${bCmd}\n`;
  });
});

writeConf(AST_FILES.dialplan, dpConf);

// 5. Копирование звуков
try {
  if (!fs.existsSync(AST_FILES.sounds)) {
    fs.mkdirSync(AST_FILES.sounds, { recursive: true });
    execSync(`chmod 777 ${AST_FILES.sounds}`);
  }
  if (fs.existsSync(FILES.sounds)) {
    execSync(`cp -r ${FILES.sounds}/* ${AST_FILES.sounds}/`);
    execSync(`chmod 666 ${AST_FILES.sounds}/*`);
    console.log('[OK] Sounds synced to Asterisk');
  }
} catch (e) {
  console.warn('[WARN] Sound sync issue (check permissions)');
}

console.log('--- Синхронизация завершена. Перезагрузите Asterisk ---');
