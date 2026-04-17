import fs from 'fs';
import path from 'path';
import ami from 'asterisk-manager';
import { exec } from 'child_process';

const DATA_DIR = path.join(process.cwd(), 'src/data');
const SOUNDS_DIR = path.join(DATA_DIR, 'sounds');
const ASTERISK_DIR = '/etc/asterisk';
const ASTERISK_SOUNDS_DIR = '/var/lib/asterisk/sounds';

// AMI Connection
const amiclient = ami(5038, '127.0.0.1', 'miac', 'MiacAMI2026', true);

console.log('🚀 [BRIDGE] Мост МИАЦ.СВЯЗЬ запущен...');
console.log(`📂 [BRIDGE] Директория данных: ${DATA_DIR}`);

function readJSON(filename) {
  const file = path.join(DATA_DIR, filename);
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return [];
  }
}

function syncFiles() {
  console.log('🔄 [BRIDGE] Начало синхронизации...');

  // 1. PJSIP USERS
  const extensions = readJSON('extensions.json');
  let pjsipUsers = '';
  extensions.forEach(ext => {
    pjsipUsers += `[${ext.id}]\ntype=endpoint\ncontext=${ext.context || 'from-internal'}\ndisallow=all\nallow=ulaw,alaw\nauth=${ext.id}\naors=${ext.id}\n\n`;
    pjsipUsers += `[${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
    pjsipUsers += `[${ext.id}]\ntype=aor\nmax_contacts=1\nremove_existing=yes\n\n`;
  });
  fs.writeFileSync(path.join(ASTERISK_DIR, 'pjsip_miac_users.conf'), pjsipUsers);
  console.log(`✅ [BRIDGE] Обновлено абонентов: ${extensions.length}`);

  // 2. PJSIP TRUNKS
  const trunks = readJSON('trunks.json');
  let pjsipTrunks = '';
  trunks.forEach(t => {
    pjsipTrunks += `[${t.id}]\ntype=registration\noutbound_auth=${t.id}\nserver_uri=sip:${t.host}:${t.port || 5060}\nclient_uri=sip:${t.user}@${t.host}:${t.port || 5060}\n\n`;
    pjsipTrunks += `[${t.id}]\ntype=auth\nauth_type=userpass\nusername=${t.user}\npassword=${t.password}\n\n`;
    pjsipTrunks += `[${t.id}]\ntype=aor\ncontact=sip:${t.host}:${t.port || 5060}\n\n`;
    pjsipTrunks += `[${t.id}]\ntype=endpoint\ncontext=from-trunk\ndisallow=all\nallow=ulaw,alaw\noutbound_auth=${t.id}\naors=${t.id}\n\n`;
    pjsipTrunks += `[${t.id}]\ntype=identify\nendpoint=${t.id}\nmatch=${t.host}\n\n`;
  });
  fs.writeFileSync(path.join(ASTERISK_DIR, 'pjsip_miac_trunks.conf'), pjsipTrunks);

  // 3. QUEUES
  const queues = readJSON('queues.json');
  let queuesConf = '';
  queues.forEach(q => {
    queuesConf += `[${q.name}]\nstrategy=${q.strategy || 'ringall'}\nmusiconhold=${q.musicOnHoldClass || 'default'}\n`;
    (q.members || []).forEach(m => {
      queuesConf += `member => PJSIP/${m}\n`;
    });
    queuesConf += `\n`;
  });
  fs.writeFileSync(path.join(ASTERISK_DIR, 'queues_miac.conf'), queuesConf);

  // 4. DIALPLAN
  const routes = readJSON('routes.json');
  const ivrs = readJSON('ivrs.json');
  let dialplan = '[from-internal]\n';
  
  // Internal Dialing
  dialplan += 'exten => _XXX,1,Dial(PJSIP/${EXTEN},30)\n';
  dialplan += 'same => n,Hangup()\n\n';

  // Outbound Routes
  routes.filter(r => r.type === 'outbound').forEach(r => {
    const trunkId = r.destination.split(':')[1];
    dialplan += `exten => ${r.pattern},1,Dial(PJSIP/\${EXTEN}@${trunkId})\n`;
    dialplan += `same => n,Hangup()\n`;
  });

  // IVRs
  ivrs.forEach(ivr => {
    dialplan += `[ivr-${ivr.id}]\nexten => s,1,Answer()\nsame => n,Playback(${ivr.announcementFile})\nsame => n,WaitExten(5)\n`;
    (ivr.digitMappings || []).forEach(m => {
      const [digit, type, target] = m.split(':');
      if (type === 'ext') dialplan += `exten => ${digit},1,Dial(PJSIP/${target},20)\n`;
      if (type === 'queue') dialplan += `exten => ${digit},1,Queue(${target})\n`;
      if (type === 'ivr') dialplan += `exten => ${digit},1,Goto(ivr-${target},s,1)\n`;
    });
  });

  // Inbound Routes
  dialplan += '\n[from-trunk]\n';
  routes.filter(r => r.type === 'inbound').forEach(r => {
    const [type, target] = r.destination.split(':');
    if (type === 'Extension') dialplan += `exten => ${r.pattern},1,Dial(PJSIP/${target})\n`;
    if (type === 'Queue') dialplan += `exten => ${r.pattern},1,Queue(${target})\n`;
    if (type === 'IVR') dialplan += `exten => ${r.pattern},1,Goto(ivr-${target},s,1)\n`;
  });

  fs.writeFileSync(path.join(ASTERISK_DIR, 'extensions_miac_dialplan.conf'), dialplan);

  // Sync Sounds
  if (fs.existsSync(SOUNDS_DIR)) {
    const files = fs.readdirSync(SOUNDS_DIR);
    files.forEach(file => {
      const src = path.join(SOUNDS_DIR, file);
      const dest = path.join(ASTERISK_SOUNDS_DIR, file);
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(src, dest);
        console.log(`🎵 [BRIDGE] Звуковой файл ${file} скопирован в Asterisk`);
      }
    });
  }

  // Reload Asterisk
  const commands = [
    'module reload res_pjsip.so',
    'module reload app_queue.so',
    'dialplan reload'
  ];

  commands.forEach(cmd => {
    amiclient.action({ action: 'Command', command: cmd }, (err, res) => {
      if (!err) console.log(`✅ [BRIDGE] Asterisk Command (${cmd}): OK`);
    });
  });
}

// Watch for changes
fs.watch(DATA_DIR, (event, filename) => {
  if (filename && filename.endsWith('.json')) {
    console.log(`📝 [BRIDGE] Изменение в ${filename}`);
    syncFiles();
  }
});

// Initial sync
syncFiles();
