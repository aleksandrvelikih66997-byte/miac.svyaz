
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

/**
 * МИАЦ.СВЯЗЬ - Скрипт синхронизации с Asterisk (PJSIP + IVR + Queues)
 */

const DATA_DIR = path.join(process.cwd(), 'src/data');
const SOUNDS_DIR = path.join(DATA_DIR, 'sounds');
const ASTERISK_CONF_DIR = '/etc/asterisk';
const ASTERISK_SOUNDS_DIR = '/var/lib/asterisk/sounds/ru'; // Путь для AltLinux

const FILES = {
  extensions: path.join(DATA_DIR, 'extensions.json'),
  trunks: path.join(DATA_DIR, 'trunks.json'),
  routes: path.join(DATA_DIR, 'routes.json'),
  queues: path.join(DATA_DIR, 'queues.json'),
  ivrs: path.join(DATA_DIR, 'ivrs.json'),
};

const AST_FILES = {
  users: path.join(ASTERISK_CONF_DIR, 'pjsip_miac_users.conf'),
  trunks: path.join(ASTERISK_CONF_DIR, 'pjsip_miac_trunks.conf'),
  queues: path.join(ASTERISK_CONF_DIR, 'queues_miac.conf'),
  dialplan: path.join(ASTERISK_CONF_DIR, 'extensions_miac_dialplan.conf'),
};

function readJSON(file) {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

async function syncAsterisk() {
  console.log(`[${new Date().toLocaleTimeString()}] Синхронизация МИАЦ.СВЯЗЬ...`);

  const extensions = readJSON(FILES.extensions);
  const trunks = readJSON(FILES.trunks);
  const routes = readJSON(FILES.routes);
  const queues = readJSON(FILES.queues);
  const ivrs = readJSON(FILES.ivrs);

  // 1. Абоненты (PJSIP)
  let usersConf = '';
  extensions.forEach(ext => {
    usersConf += `[${ext.id}]\ntype=endpoint\ncontext=from-internal\ndisallow=all\nallow=ulaw,alaw,g722\nauth=auth-${ext.id}\naors=${ext.id}\nrtp_symmetric=yes\nforce_rport=yes\nrewrite_contact=yes\nidentify_by=auth_username,username\n\n`;
    usersConf += `[auth-${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
    usersConf += `[${ext.id}]\ntype=aor\nmax_contacts=5\nremove_existing=yes\n\n`;
  });
  fs.writeFileSync(AST_FILES.users, usersConf);

  // 2. Транки (PJSIP + Identify)
  let trunksConf = '';
  trunks.forEach(t => {
    const transport = 'transport-udp-nat';
    trunksConf += `[registration-${t.id}]\ntype=registration\nserver_uri=sip:${t.host}:${t.port}\nclient_uri=sip:${t.user}@${t.host}:${t.port}\noutbound_auth=auth-${t.id}\nline=yes\nendpoint=trunk-${t.id}\n\n`;
    trunksConf += `[trunk-${t.id}]\ntype=endpoint\ncontext=from-trunk\ndisallow=all\nallow=ulaw,alaw\noutbound_auth=auth-${t.id}\naors=aor-${t.id}\nfrom_user=${t.user}\n\n`;
    trunksConf += `[auth-${t.id}]\ntype=auth\nauth_type=userpass\nusername=${t.user}\npassword=${t.password}\n\n`;
    trunksConf += `[aor-${t.id}]\ntype=aor\ncontact=sip:${t.host}:${t.port}\n\n`;
    trunksConf += `[identify-${t.id}]\ntype=identify\nendpoint=trunk-${t.id}\nmatch=${t.host}\n\n`;
  });
  fs.writeFileSync(AST_FILES.trunks, trunksConf);

  // 3. Очереди (Queues)
  let queuesConf = '';
  queues.forEach(q => {
    queuesConf += `[${q.name}]\nstrategy=${q.strategy}\nmusicclass=${q.musicOnHoldClass || 'default'}\ntimeout=20\nretry=5\nwrapuptime=10\n`;
    (q.members || []).forEach(m => {
      queuesConf += `member => PJSIP/${m}\n`;
    });
    queuesConf += `\n`;
  });
  fs.writeFileSync(AST_FILES.queues, queuesConf);

  // 4. Диалплан (Маршруты + IVR)
  let dpConf = '[from-internal]\n';
  extensions.forEach(ext => {
    dpConf += `exten => ${ext.id},1,NoOp(Call to ${ext.name})\n`;
    dpConf += `same => n,Dial(PJSIP/${ext.id},30)\n`;
    dpConf += `same => n,Hangup()\n`;
  });

  // Исходящие маршруты
  routes.filter(r => r.type === 'outbound').forEach(r => {
    const trunkId = r.destination.split(':')[1];
    dpConf += `exten => _${r.pattern},1,NoOp(Outbound via ${trunkId})\n`;
    dpConf += `same => n,Dial(PJSIP/\${EXTEN}@trunk-${trunkId})\n`;
    dpConf += `same => n,Hangup()\n`;
  });

  // Контекст для входящих
  dpConf += '\n[from-trunk]\n';
  dpConf += 'exten => s,1,NoOp(Inbound call to standard extension S)\n';
  const firstRoute = routes.find(r => r.type === 'inbound');
  if (firstRoute) {
    const [type, id] = firstRoute.destination.split(':');
    if (type === 'Extension') dpConf += `same => n,Goto(from-internal,${id},1)\n`;
    else if (type === 'Queue') dpConf += `same => n,Queue(${id})\n`;
    else if (type === 'IVR') dpConf += `same => n,Goto(miac-ivr-${id},s,1)\n`;
  } else {
    dpConf += 'same => n,Hangup()\n';
  }

  routes.filter(r => r.type === 'inbound').forEach(r => {
    const [type, target] = r.destination.split(':');
    dpConf += `exten => ${r.pattern},1,NoOp(Inbound DID match)\n`;
    if (type === 'Extension') dpConf += `same => n,Goto(from-internal,${target},1)\n`;
    else if (type === 'Queue') dpConf += `same => n,Queue(${target})\n`;
    else if (type === 'IVR') dpConf += `same => n,Goto(miac-ivr-${target},s,1)\n`;
    dpConf += `same => n,Hangup()\n`;
  });

  // IVR Контексты
  ivrs.forEach(ivr => {
    dpConf += `\n[miac-ivr-${ivr.id}]\n`;
    dpConf += `exten => s,1,Answer()\n`;
    dpConf += `same => n,Wait(1)\n`;
    dpConf += `same => n,Background(${ivr.announcementFile})\n`;
    dpConf += `same => n,WaitExten(5)\n`;

    (ivr.digitMappings || []).forEach(m => {
      const [digit, type, target] = m.split(':');
      if (type === 'ext') dpConf += `exten => ${digit},1,Goto(from-internal,${target},1)\n`;
      else if (type === 'queue') dpConf += `exten => ${digit},1,Queue(${target})\n`;
      else if (type === 'ivr') dpConf += `exten => ${digit},1,Goto(miac-ivr-${target},s,1)\n`;
    });

    // Обработка таймаута IVR
    if (ivr.timeoutDestination && ivr.timeoutDestination !== 'hangup') {
      const [type, target] = ivr.timeoutDestination.split(':');
      if (type === 'Extension') dpConf += `exten => t,1,Goto(from-internal,${target},1)\n`;
      else if (type === 'Queue') dpConf += `exten => t,1,Queue(${target})\n`;
    } else {
      dpConf += `exten => t,1,Hangup()\n`;
    }
    dpConf += `exten => i,1,Playback(invalid)\n`;
    dpConf += `same => n,Goto(s,3)\n`;
  });

  fs.writeFileSync(AST_FILES.dialplan, dpConf);

  // 5. Синхронизация звуков
  if (fs.existsSync(SOUNDS_DIR)) {
    const files = fs.readdirSync(SOUNDS_DIR);
    files.forEach(file => {
      const src = path.join(SOUNDS_DIR, file);
      const dest = path.join(ASTERISK_SOUNDS_DIR, file);
      try {
        if (!fs.existsSync(ASTERISK_SOUNDS_DIR)) fs.mkdirSync(ASTERISK_SOUNDS_DIR, { recursive: true });
        fs.copyFileSync(src, dest);
        fs.chmodSync(dest, 0o666);
      } catch (e) {
        console.error(`Ошибка копирования звука ${file}:`, e.message);
      }
    });
  }

  // Применяем настройки
  exec('asterisk -rx "core reload"');
  console.log(`[SUCCESS] Конфигурация успешно обновлена в ${ASTERISK_CONF_DIR}`);
}

// Запуск при старте и наблюдение за изменениями
syncAsterisk();
setInterval(syncAsterisk, 15000);
