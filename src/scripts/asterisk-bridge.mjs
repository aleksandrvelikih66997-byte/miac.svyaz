
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data');
const SOUNDS_DIR = path.join(DATA_DIR, 'sounds');
const AST_SOUNDS_DIR = '/var/lib/asterisk/sounds';

// Пути к конфигам Asterisk
const AST_PATH = '/etc/asterisk';
const CONFIGS = {
  users: path.join(AST_PATH, 'pjsip_miac_users.conf'),
  trunks: path.join(AST_PATH, 'pjsip_miac_trunks.conf'),
  queues: path.join(AST_PATH, 'queues_miac.conf'),
  dialplan: path.join(AST_PATH, 'extensions_miac_dialplan.conf'),
};

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SOUNDS_DIR)) fs.mkdirSync(SOUNDS_DIR, { recursive: true });
}

function readJSON(filename) {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return [];
  }
}

function generatePJSIPUsers(extensions) {
  let conf = '; --- MIAC PBX GENERATED USERS ---\n\n';
  extensions.forEach(ext => {
    conf += `[${ext.id}]\ntype=endpoint\nauth=auth-${ext.id}\naors=${ext.id}\ncontext=${ext.context || 'from-internal'}\n`;
    conf += `disallow=all\nallow=ulaw,alaw,g722\ndirect_media=no\nrtp_symmetric=yes\nforce_rport=yes\nrewrite_contact=yes\n`;
    conf += `identify_by=auth_username,username\n\n`;

    conf += `[auth-${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;

    conf += `[${ext.id}]\ntype=aor\nmax_contacts=5\nremove_existing=yes\n\n`;
  });
  return conf;
}

function generatePJSIPTrunks(trunks) {
  let conf = '; --- MIAC PBX GENERATED TRUNKS ---\n\n';
  trunks.forEach(t => {
    const trunkId = `trunk-${t.id}`;
    conf += `[registration-${t.id}]\ntype=registration\nline=yes\nendpoint=${trunkId}\n`;
    conf += `server_uri=sip:${t.host}:${t.port || 5060}\nclient_uri=sip:${t.user}@${t.host}:${t.port || 5060}\n`;
    conf += `contact_user=${t.user}\noutbound_auth=auth-${t.id}\nretry_interval=60\n\n`;

    conf += `[${trunkId}]\ntype=endpoint\ncontext=from-trunk\ndisallow=all\nallow=ulaw,alaw\n`;
    conf += `outbound_auth=auth-${t.id}\naors=${trunkId}\n\n`;

    conf += `[auth-${t.id}]\ntype=auth\nauth_type=userpass\nusername=${t.user}\npassword=${t.password}\n\n`;

    conf += `[${trunkId}]\ntype=aor\ncontact=sip:${t.host}:${t.port || 5060}\n\n`;
    
    conf += `[identify-${t.id}]\ntype=identify\nendpoint=${trunkId}\nmatch=${t.host}\n\n`;
  });
  return conf;
}

function generateQueues(queues) {
  let conf = '; --- MIAC PBX GENERATED QUEUES ---\n\n';
  queues.forEach(q => {
    conf += `[${q.name}]\nstrategy=${q.strategy || 'ringall'}\nmusiconhold=${q.musicOnHoldClass || 'default'}\n`;
    conf += `timeout=15\nretry=5\nwrapuptime=0\n`;
    (q.members || []).forEach(m => {
      conf += `member => PJSIP/${m}\n`;
    });
    conf += `\n`;
  });
  return conf;
}

function generateDialplan(routes, ivrs) {
  let conf = '; --- MIAC PBX GENERATED DIALPLAN ---\n\n';

  conf += '[from-internal]\n';
  conf += 'exten => _XXX,1,Dial(PJSIP/${EXTEN},30)\n';
  conf += 'same => n,Hangup()\n\n';

  // Исходящие маршруты
  const outbound = routes.filter(r => r.type === 'outbound');
  outbound.forEach(r => {
    const trunkId = r.destination.replace('Trunk:', 'trunk-');
    conf += `exten => ${r.pattern},1,NoOp(Outbound Call via ${trunkId})\n`;
    conf += `same => n,Dial(PJSIP/\${EXTEN}@${trunkId})\n`;
    conf += `same => n,Hangup()\n\n`;
  });

  // Входящие маршруты
  conf += '[from-trunk]\n';
  const inbound = routes.filter(r => r.type === 'inbound');
  
  // Добавляем обработку стандартного экстеншена 's' и пустых DID
  if (inbound.length > 0) {
    const firstDest = inbound[0].destination;
    let cmd = '';
    if (firstDest.startsWith('Extension:')) cmd = `Dial(PJSIP/${firstDest.split(':')[1]},30)`;
    else if (firstDest.startsWith('Queue:')) cmd = `Queue(${firstDest.split(':')[1]})`;
    else if (firstDest.startsWith('IVR:')) cmd = `Goto(ivr-${firstDest.split(':')[1]},s,1)`;

    conf += `exten => s,1,NoOp(Inbound Call to S - Routing to default)\n`;
    conf += `same => n,${cmd}\n`;
    conf += `same => n,Hangup()\n\n`;
  }

  inbound.forEach(r => {
    let cmd = '';
    if (r.destination.startsWith('Extension:')) cmd = `Dial(PJSIP/${r.destination.split(':')[1]},30)`;
    else if (r.destination.startsWith('Queue:')) cmd = `Queue(${r.destination.split(':')[1]})`;
    else if (r.destination.startsWith('IVR:')) cmd = `Goto(ivr-${r.destination.split(':')[1]},s,1)`;

    conf += `exten => ${r.pattern},1,NoOp(Inbound Call for DID ${r.pattern})\n`;
    conf += `same => n,${cmd}\n`;
    conf += `same => n,Hangup()\n\n`;
  });

  // IVR секции
  ivrs.forEach(ivr => {
    conf += `[ivr-${ivr.id}]\n`;
    conf += `exten => s,1,Answer()\n`;
    conf += `same => n,Background(${ivr.announcementFile})\n`;
    conf += `same => n,WaitExten(5)\n\n`;

    (ivr.digitMappings || []).forEach(m => {
      const [digit, type, target] = m.split(':');
      let targetCmd = '';
      if (type === 'ext') targetCmd = `Dial(PJSIP/${target},30)`;
      else if (type === 'queue') targetCmd = `Queue(${target})`;
      else if (type === 'ivr') targetCmd = `Goto(ivr-${target},s,1)`;

      conf += `exten => ${digit},1,${targetCmd}\n`;
    });
    conf += `exten => t,1,Hangup()\n`;
    conf += `exten => i,1,Playback(invalid)\n`;
    conf += `same => n,Goto(s,1)\n\n`;
  });

  return conf;
}

function syncSounds() {
  if (!fs.existsSync(SOUNDS_DIR)) return;
  const files = fs.readdirSync(SOUNDS_DIR);
  files.forEach(file => {
    const src = path.join(SOUNDS_DIR, file);
    const dest = path.join(AST_SOUNDS_DIR, file);
    try {
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(src, dest);
        fs.chmodSync(dest, 0o666);
        console.log(`[SYNC] Sound file copied: ${file}`);
      }
    } catch (e) {
      console.error(`[ERROR] Failed to sync sound ${file}:`, e.message);
    }
  });
}

function updateConfigs() {
  console.log('--- SYNC START ---');
  
  const extensions = readJSON('extensions.json');
  const trunks = readJSON('trunks.json');
  const routes = readJSON('routes.json');
  const queues = readJSON('queues.json');
  const ivrs = readJSON('ivrs.json');

  try {
    fs.writeFileSync(CONFIGS.users, generatePJSIPUsers(extensions));
    fs.writeFileSync(CONFIGS.trunks, generatePJSIPTrunks(trunks));
    fs.writeFileSync(CONFIGS.queues, generateQueues(queues));
    fs.writeFileSync(CONFIGS.dialplan, generateDialplan(routes, ivrs));
    
    syncSounds();

    console.log('[OK] Configs generated. Reloading Asterisk...');
    // В реальной среде здесь должен быть вызов AMI или asterisk -rx
    // exec('asterisk -rx "core reload"');
  } catch (e) {
    console.error('[ERROR] Failed to write configs:', e.message);
  }
}

// Следим за изменениями
ensureDirs();
updateConfigs();

const watchPaths = [
  path.join(DATA_DIR, 'extensions.json'),
  path.join(DATA_DIR, 'trunks.json'),
  path.join(DATA_DIR, 'routes.json'),
  path.join(DATA_DIR, 'queues.json'),
  path.join(DATA_DIR, 'ivrs.json'),
];

watchPaths.forEach(p => {
  if (fs.existsSync(p)) {
    fs.watch(p, (event) => {
      if (event === 'change') {
        console.log(`[CHANGE] Detected change in ${path.basename(p)}`);
        updateConfigs();
      }
    });
  }
});

fs.watch(SOUNDS_DIR, () => {
  syncSounds();
});

console.log('🚀 [BRIDGE] Мост МИАЦ.СВЯЗЬ запущен и следит за данными...');
