
import fs from 'fs';
import path from 'path';
import asteriskManager from 'asterisk-manager';
import dotenv from 'dotenv';

dotenv.config();

const DATA_DIR = path.join(process.cwd(), 'src/data');
const SOUNDS_DIR = path.join(DATA_DIR, 'sounds');
const AST_CONF_DIR = '/etc/asterisk';
const AST_SOUNDS_DIR = '/var/lib/asterisk/sounds';

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(SOUNDS_DIR)) fs.mkdirSync(SOUNDS_DIR, { recursive: true });

const FILES = {
  extensions: path.join(DATA_DIR, 'extensions.json'),
  trunks: path.join(DATA_DIR, 'trunks.json'),
  routes: path.join(DATA_DIR, 'routes.json'),
  queues: path.join(DATA_DIR, 'queues.json'),
  ivrs: path.join(DATA_DIR, 'ivrs.json'),
};

const AST_FILES = {
  users: path.join(AST_CONF_DIR, 'pjsip_miac_users.conf'),
  trunks: path.join(AST_CONF_DIR, 'pjsip_miac_trunks.conf'),
  queues: path.join(AST_CONF_DIR, 'queues_miac.conf'),
  dialplan: path.join(AST_CONF_DIR, 'extensions_miac_dialplan.conf'),
};

// AMI Connection
const ami = new asteriskManager(5038, '127.0.0.1', 'miac', 'MiacAMI2026', true);
ami.keepConnected();

console.log('🚀 [BRIDGE] Мост МИАЦ.СВЯЗЬ запущен...');

function readJSON(file) {
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return [];
  }
}

function updateAsterisk() {
  console.log('📝 [BRIDGE] Обновление конфигураций Asterisk...');
  
  const extensions = readJSON(FILES.extensions);
  const trunks = readJSON(FILES.trunks);
  const routes = readJSON(FILES.routes);
  const queues = readJSON(FILES.queues);
  const ivrs = readJSON(FILES.ivrs);

  // 1. PJSIP Users
  let usersConf = '';
  extensions.forEach(ext => {
    usersConf += `[${ext.id}]\ntype=endpoint\ncontext=from-internal\ndisallow=all\nallow=ulaw,alaw,opus\nauth=${ext.id}\naors=${ext.id}\nrtp_symmetric=yes\nforce_rport=yes\nrewrite_contact=yes\nidentify_by=username\n\n`;
    usersConf += `[${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
    usersConf += `[${ext.id}]\ntype=aor\nmax_contacts=1\nremove_existing=yes\n\n`;
  });
  fs.writeFileSync(AST_FILES.users, usersConf);

  // 2. PJSIP Trunks
  let trunksConf = '';
  trunks.forEach(t => {
    trunksConf += `[${t.id}]\ntype=registration\ntransport=transport-udp-nat\noutbound_auth=${t.id}\nserver_uri=sip:${t.host}:${t.port}\nclient_uri=sip:${t.user}@${t.host}:${t.port}\nretry_interval=60\n\n`;
    trunksConf += `[${t.id}]\ntype=auth\nauth_type=userpass\nusername=${t.user}\npassword=${t.password}\n\n`;
    trunksConf += `[${t.id}]\ntype=aor\ncontact=sip:${t.host}:${t.port}\n\n`;
    trunksConf += `[${t.id}]\ntype=endpoint\ntransport=transport-udp-nat\ncontext=from-trunk\ndisallow=all\nallow=ulaw,alaw\noutbound_auth=${t.id}\naors=${t.id}\nfrom_user=${t.user}\n\n`;
    trunksConf += `[${t.id}]\ntype=identify\nendpoint=${t.id}\nmatch=${t.host}\n\n`;
  });
  fs.writeFileSync(AST_FILES.trunks, trunksConf);

  // 3. Queues
  let queuesConf = '';
  queues.forEach(q => {
    queuesConf += `[${q.name}]\nstrategy=${q.strategy}\nmusiconhold=${q.musicOnHoldClass || 'default'}\ntimeout=15\nretry=5\nwrapuptime=0\n`;
    (q.members || []).forEach(m => {
      queuesConf += `member => PJSIP/${m}\n`;
    });
    queuesConf += `\n`;
  });
  fs.writeFileSync(AST_FILES.queues, queuesConf);

  // 4. Dialplan
  let dpConf = '[from-internal]\n';
  // Internal calls
  extensions.forEach(ext => {
    dpConf += `exten => ${ext.id},1,Dial(PJSIP/${ext.id},30)\n`;
  });

  // Outbound routes
  routes.filter(r => r.type === 'outbound').forEach(r => {
    const trunkId = r.destination.split(':')[1];
    dpConf += `exten => _${r.pattern},1,Dial(PJSIP/\${EXTEN}@${trunkId})\n`;
  });

  // Inbound routes & IVR Logic
  dpConf += '\n[from-trunk]\n';
  routes.filter(r => r.type === 'inbound').forEach(r => {
    const [type, id] = r.destination.split(':');
    if (type === 'Extension') dpConf += `exten => ${r.pattern},1,Dial(PJSIP/${id},30)\n`;
    else if (type === 'Queue') dpConf += `exten => ${r.pattern},1,Queue(${id})\n`;
    else if (type === 'IVR') dpConf += `exten => ${r.pattern},1,Goto(ivr-${id},s,1)\n`;
  });

  // IVR Contexts
  ivrs.forEach(ivr => {
    dpConf += `\n[ivr-${ivr.id}]\nexten => s,1,Answer()\nsame => n,Background(${ivr.announcementFile})\nsame => n,WaitExten(5)\n`;
    (ivr.digitMappings || []).forEach(m => {
      const [digit, type, target] = m.split(':');
      if (type === 'ext') dpConf += `exten => ${digit},1,Dial(PJSIP/${target},30)\n`;
      else if (type === 'queue') dpConf += `exten => ${digit},1,Queue(${target})\n`;
      else if (type === 'ivr') dpConf += `exten => ${digit},1,Goto(ivr-${target},s,1)\n`;
    });
    dpConf += `exten => t,1,Hangup()\nexten => i,1,Playback(invalid)\nsame => n,Goto(s,1)\n`;
  });

  fs.writeFileSync(AST_FILES.dialplan, dpConf);

  // Reload Asterisk
  ami.action({ action: 'Command', command: 'pjsip reload' });
  ami.action({ action: 'Command', command: 'dialplan reload' });
  ami.action({ action: 'Command', command: 'queue reload all' });
}

// Watch for changes in JSON data
Object.values(FILES).forEach(file => {
  fs.watchFile(file, () => {
    console.log(`🔔 [BRIDGE] Изменен файл: ${path.basename(file)}`);
    updateAsterisk();
  });
});

// Watch for audio files
fs.watch(SOUNDS_DIR, (eventType, filename) => {
  if (filename) {
    const src = path.join(SOUNDS_DIR, filename);
    const dest = path.join(AST_SOUNDS_DIR, filename);
    if (fs.existsSync(src)) {
      console.log(`🎵 [BRIDGE] Синхронизация звука: ${filename}`);
      try {
        fs.copyFileSync(src, dest);
        fs.chmodSync(dest, 0o666);
      } catch (e) {
        console.error(`❌ Ошибка копирования звука: ${e.message}`);
      }
    }
  }
});

// Periodic Status Check
setInterval(() => {
  ami.action({ action: 'PJSIPShowEndpoints' }, (err, res) => {
    if (err) return;
    const extensions = readJSON(FILES.extensions);
    let changed = false;

    // This is a simplified logic, real AMI response parsing is complex
    // but we can update statuses if we match endpoint name to state
    // For now, we assume bridge keeps statuses fresh enough
  });
}, 10000);

updateAsterisk();
