
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const DATA_DIR = path.join(process.cwd(), 'src/data');
const SOUNDS_DIR = path.join(DATA_DIR, 'sounds');
const AST_DIR = '/etc/asterisk';
const AST_SOUNDS = '/var/lib/asterisk/sounds/ru';

// Гарантируем наличие папок
if (!fs.existsSync(SOUNDS_DIR)) fs.mkdirSync(SOUNDS_DIR, { recursive: true });

function readJSON(file) {
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) return [];
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return [];
  }
}

function reloadAsterisk(module) {
  try {
    execSync(`asterisk -rx "${module} reload"`);
    console.log(`[BRIDGE] Asterisk module ${module} reloaded`);
  } catch (e) {
    console.warn(`[BRIDGE] Warning: Failed to reload ${module} (Asterisk might be down)`);
  }
}

function syncSounds() {
  if (!fs.existsSync(AST_SOUNDS)) {
    try { execSync(`mkdir -p ${AST_SOUNDS}`); } catch(e) {}
  }
  if (fs.existsSync(SOUNDS_DIR)) {
    const files = fs.readdirSync(SOUNDS_DIR);
    files.forEach(file => {
      const src = path.join(SOUNDS_DIR, file);
      const dest = path.join(AST_SOUNDS, file);
      try {
        if (!fs.existsSync(dest) || fs.statSync(src).mtime > fs.statSync(dest).mtime) {
          fs.copyFileSync(src, dest);
          fs.chmodSync(dest, 0o666);
          console.log(`[BRIDGE] Synced sound: ${file}`);
        }
      } catch (e) {}
    });
  }
}

function generateConfigs() {
  console.log('[BRIDGE] Generating Asterisk configs...');
  const exts = readJSON('extensions.json');
  const trunks = readJSON('trunks.json');
  const routes = readJSON('routes.json');
  const queues = readJSON('queues.json');
  const ivrs = readJSON('ivrs.json');

  // 1. PJSIP Users
  let pjsipUsers = '';
  exts.forEach(e => {
    pjsipUsers += `[${e.id}]
type=endpoint
context=from-internal
disallow=all
allow=ulaw,alaw,g722
auth=auth-${e.id}
aors=${e.id}
identify_by=auth_username,username
rtp_symmetric=yes
force_rport=yes
rewrite_contact=yes
direct_media=no

[auth-${e.id}]
type=auth
auth_type=userpass
username=${e.id}
password=${e.secret}

[${e.id}]
type=aor
max_contacts=5
remove_existing=yes\n\n`;
  });
  fs.writeFileSync(path.join(AST_DIR, 'pjsip_miac_users.conf'), pjsipUsers);

  // 2. PJSIP Trunks
  let pjsipTrunks = '';
  trunks.forEach(t => {
    pjsipTrunks += `[registration-${t.id}]
type=registration
server_uri=sip:${t.host}:${t.port}
client_uri=sip:${t.user}@${t.host}:${t.port}
auth_rejection_permanent=no
retry_interval=60
expiration=3600
line=yes
endpoint=trunk-${t.id}
outbound_auth=auth-${t.id}

[auth-${t.id}]
type=auth
auth_type=userpass
username=${t.user}
password=${t.password}

[trunk-${t.id}]
type=endpoint
context=from-trunk
disallow=all
allow=ulaw,alaw
outbound_auth=auth-${t.id}
aors=trunk-${t.id}
identify_by=username

[trunk-${t.id}]
type=aor
contact=sip:${t.host}:${t.port}\n\n`;
  });
  fs.writeFileSync(path.join(AST_DIR, 'pjsip_miac_trunks.conf'), pjsipTrunks);

  // 3. Queues
  let queuesConf = '';
  queues.forEach(q => {
    queuesConf += `[${q.name}]
strategy=${q.strategy || 'ringall'}
musicclass=${q.musicOnHoldClass || 'default'}
timeout=15
retry=5
wrapuptime=0
announce-holdtime=yes\n`;
    (q.members || []).forEach(m => {
      queuesConf += `member => PJSIP/${m}\n`;
    });
    queuesConf += '\n';
  });
  fs.writeFileSync(path.join(AST_DIR, 'queues_miac.conf'), queuesConf);

  // 4. Extensions (Dialplan)
  let extensionsConf = '[from-internal]\n';
  // Внутренние звонки
  exts.forEach(e => {
    extensionsConf += `exten => ${e.id},1,Dial(PJSIP/${e.id},30)\n`;
  });

  // Исходящие маршруты
  routes.filter(r => r.type === 'outbound').forEach(r => {
    const trunkId = r.destination.split(':')[1];
    extensionsConf += `exten => _${r.pattern},1,Dial(PJSIP/\${EXTEN}@trunk-${trunkId})\n`;
  });

  // Входящие маршруты
  extensionsConf += '\n[from-trunk]\n';
  // Обработка служебного экстеншена 's' (если провайдер не шлет DID)
  const firstInbound = routes.find(r => r.type === 'inbound');
  if (firstInbound) {
    const [type, target] = firstInbound.destination.split(':');
    let cmd = '';
    if (type === 'Extension') cmd = `Dial(PJSIP/${target},30)`;
    else if (type === 'Queue') cmd = `Queue(${target})`;
    else if (type === 'IVR') cmd = `Goto(miac-ivr-${target},s,1)`;
    extensionsConf += `exten => s,1,NoOp(Incoming call on S extension)\n`;
    extensionsConf += `exten => s,n,${cmd}\n`;
  }

  routes.filter(r => r.type === 'inbound').forEach(r => {
    const [type, target] = r.destination.split(':');
    let cmd = '';
    if (type === 'Extension') cmd = `Dial(PJSIP/${target},30)`;
    else if (type === 'Queue') cmd = `Queue(${target})`;
    else if (type === 'IVR') cmd = `Goto(miac-ivr-${target},s,1)`;
    extensionsConf += `exten => ${r.pattern},1,${cmd}\n`;
  });

  // Контексты IVR
  ivrs.forEach(ivr => {
    extensionsConf += `\n[miac-ivr-${ivr.id}]\n`;
    extensionsConf += `exten => s,1,Answer()\n`;
    extensionsConf += `exten => s,n,Background(${ivr.announcementFile})\n`;
    extensionsConf += `exten => s,n,WaitExten(5)\n`;
    (ivr.digitMappings || []).forEach(m => {
      const [digit, type, target] = m.split(':');
      let cmd = '';
      if (type === 'ext') cmd = `Dial(PJSIP/${target},30)`;
      else if (type === 'queue') cmd = `Queue(${target})`;
      else if (type === 'ivr') cmd = `Goto(miac-ivr-${target},s,1)`;
      extensionsConf += `exten => ${digit},1,${cmd}\n`;
    });
    extensionsConf += `exten => i,1,Playback(invalid)\n`;
    extensionsConf += `exten => i,n,Goto(s,1)\n`;
    extensionsConf += `exten => t,1,Hangup()\n`;
  });

  fs.writeFileSync(path.join(AST_DIR, 'extensions_miac_dialplan.conf'), extensionsConf);

  syncSounds();
  reloadAsterisk('pjsip');
  reloadAsterisk('queues');
  reloadAsterisk('dialplan');
}

// Следим за изменениями
fs.watch(DATA_DIR, (eventType, filename) => {
  if (filename && filename.endsWith('.json')) {
    console.log(`[BRIDGE] Data change: ${filename}`);
    generateConfigs();
  }
});

console.log('[BRIDGE] Monitoring Asterisk data...');
generateConfigs();
