
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const DATA_DIR = path.join(process.cwd(), 'src/data');
const SOUNDS_DIR = path.join(DATA_DIR, 'sounds');
const ASTERISK_SOUNDS = '/var/lib/asterisk/sounds/miac';
const CONF_DIR = '/etc/asterisk';

const FILES = {
  extensions: path.join(DATA_DIR, 'extensions.json'),
  trunks: path.join(DATA_DIR, 'trunks.json'),
  routes: path.join(DATA_DIR, 'routes.json'),
  queues: path.join(DATA_DIR, 'queues.json'),
  ivrs: path.join(DATA_DIR, 'ivrs.json'),
};

function readJSON(file) {
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return [];
  }
}

async function run() {
  console.log('--- МИАЦ.СВЯЗЬ: Запуск синхронизации ---');

  const extensions = readJSON(FILES.extensions);
  const trunks = readJSON(FILES.trunks);
  const routes = readJSON(FILES.routes);
  const queues = readJSON(FILES.queues);
  const ivrs = readJSON(FILES.ivrs);

  // 1. Генерируем PJSIP Users
  let usersConf = '; Генерируемые абоненты МИАЦ\n\n';
  extensions.forEach(ext => {
    usersConf += `[${ext.id}]\ntype=endpoint\ncontext=miac-internal\ndisallow=all\nallow=ulaw,alaw\nauth=auth-${ext.id}\naors=${ext.id}\n\n`;
    usersConf += `[auth-${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
    usersConf += `[${ext.id}]\ntype=aor\nmax_contacts=5\n\n`;
  });
  fs.writeFileSync(path.join(CONF_DIR, 'pjsip_miac_users.conf'), usersConf);

  // 2. Генерируем PJSIP Trunks
  let trunksConf = '; Генерируемые транки МИАЦ\n\n';
  trunks.forEach(t => {
    trunksConf += `[trunk-${t.id}]\ntype=endpoint\ncontext=from-trunk\ndisallow=all\nallow=ulaw,alaw\noutbound_auth=auth-${t.id}\naors=aor-${t.id}\n\n`;
    trunksConf += `[auth-${t.id}]\ntype=auth\nauth_type=userpass\nusername=${t.user}\npassword=${t.password}\n\n`;
    trunksConf += `[aor-${t.id}]\ntype=aor\ncontact=sip:${t.host}:${t.port}\n\n`;
    trunksConf += `[reg-${t.id}]\ntype=registration\noutbound_auth=auth-${t.id}\nserver_uri=sip:${t.host}:${t.port}\nclient_uri=sip:${t.user}@${t.host}:${t.port}\nretry_interval=60\nexpiration=120\n\n`;
    trunksConf += `[identify-${t.id}]\ntype=identify\nendpoint=trunk-${t.id}\nmatch=${t.host}\n\n`;
  });
  fs.writeFileSync(path.join(CONF_DIR, 'pjsip_miac_trunks.conf'), trunksConf);

  // 3. Генерируем Очереди
  let queuesConf = '; Генерируемые очереди МИАЦ\n\n';
  queues.forEach(q => {
    queuesConf += `[${q.name}]\nstrategy=${q.strategy}\nmusicclass=${q.musicOnHoldClass || 'default'}\n`;
    (q.members || []).forEach(m => {
      queuesConf += `member => PJSIP/${m}\n`;
    });
    queuesConf += '\n';
  });
  fs.writeFileSync(path.join(CONF_DIR, 'queues_miac.conf'), queuesConf);

  // 4. Генерируем Диалплан (Маршруты + IVR)
  let dialplan = '; Генерируемый диалплан МИАЦ\n\n';

  // Входящие
  dialplan += '[from-trunk]\n';
  const inbound = routes.filter(r => r.type === 'inbound');
  inbound.forEach(r => {
    const pattern = r.pattern === '*' ? 's' : r.pattern;
    const target = r.destination.startsWith('IVR:') 
      ? `miac-ivr-${r.destination.split(':')[1]},s,1`
      : r.destination.startsWith('Extension:') 
      ? `miac-internal,${r.destination.split(':')[1]},1`
      : `miac-queues,${r.destination.split(':')[1]},1`;
    
    dialplan += `exten => ${pattern},1,Goto(${target})\n`;
    if (pattern === 's') dialplan += `exten => _.,1,Goto(${target})\n`;
  });
  dialplan += 'exten => s,n,Hangup()\n\n';

  // IVR
  ivrs.forEach(ivr => {
    dialplan += `[miac-ivr-${ivr.id}]\n`;
    dialplan += `exten => s,1,Answer()\n`;
    dialplan += `exten => s,n,Progress()\n`;
    dialplan += `exten => s,n,Wait(1)\n`;
    dialplan += `exten => s,n,Background(miac/${ivr.announcementFile})\n`;
    dialplan += `exten => s,n,WaitExten(5)\n`;
    
    (ivr.digitMappings || []).forEach(m => {
      const [digit, type, target] = m.split(':');
      if (type === 'ext') dialplan += `exten => ${digit},1,Dial(PJSIP/${target},30)\n`;
      if (type === 'queue') dialplan += `exten => ${digit},1,Queue(${target})\n`;
      if (type === 'ivr') dialplan += `exten => ${digit},1,Goto(miac-ivr-${target},s,1)\n`;
    });

    if (ivr.timeoutDestination && ivr.timeoutDestination !== 'hangup') {
      const t = ivr.timeoutDestination.split(':');
      const action = t[0] === 'Extension' ? `Dial(PJSIP/${t[1]},30)` : `Queue(${t[1]})`;
      dialplan += `exten => t,1,${action}\n`;
    } else {
      dialplan += `exten => t,1,Hangup()\n`;
    }
    dialplan += '\n';
  });

  // Внутренние
  dialplan += '[miac-internal]\n';
  dialplan += 'exten => _XXX,1,Dial(PJSIP/${EXTEN},30)\n';
  dialplan += 'exten => _XXX,n,Hangup()\n\n';

  fs.writeFileSync(path.join(CONF_DIR, 'extensions_miac_dialplan.conf'), dialplan);

  // 5. Копируем звуки
  try {
    if (!fs.existsSync(ASTERISK_SOUNDS)) {
      execSync(`mkdir -p ${ASTERISK_SOUNDS}`);
    }
    if (fs.existsSync(SOUNDS_DIR)) {
      execSync(`cp -r ${SOUNDS_DIR}/* ${ASTERISK_SOUNDS}/`);
      execSync(`chmod -R 777 ${ASTERISK_SOUNDS}`);
    }
  } catch (e) {
    console.error('Ошибка копирования звуков:', e.message);
  }

  console.log('--- Синхронизация завершена успешно! ---');
}

run();
