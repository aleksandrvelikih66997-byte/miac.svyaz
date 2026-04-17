
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

const DATA_DIR = path.join(process.cwd(), 'src/data');
const SOUNDS_DIR = path.join(process.cwd(), 'src/data/sounds');
const ASTERISK_DIR = '/etc/asterisk';
const ASTERISK_SOUNDS = '/var/lib/asterisk/sounds/ru';

// Гарантируем наличие папок
if (!fs.existsSync(SOUNDS_DIR)) fs.mkdirSync(SOUNDS_DIR, { recursive: true });

const CONFIG_FILES = {
  extensions: path.join(ASTERISK_DIR, 'extensions_miac_dialplan.conf'),
  users: path.join(ASTERISK_DIR, 'pjsip_miac_users.conf'),
  trunks: path.join(ASTERISK_DIR, 'pjsip_miac_trunks.conf'),
  queues: path.join(ASTERISK_DIR, 'queues_miac.conf')
};

function log(msg) { console.log(`🚀 [BRIDGE] ${msg}`); }

function reloadAsterisk() {
  exec('asterisk -rx "core reload"', (err) => {
    if (err) log(`Reload Error: ${err.message}`);
    else log('Asterisk reloaded successfully');
  });
}

function syncSounds() {
  if (!fs.existsSync(SOUNDS_DIR)) return;
  const files = fs.readdirSync(SOUNDS_DIR);
  files.forEach(file => {
    const src = path.join(SOUNDS_DIR, file);
    const dest = path.join(ASTERISK_SOUNDS, file);
    try {
      if (!fs.existsSync(ASTERISK_SOUNDS)) fs.mkdirSync(ASTERISK_SOUNDS, { recursive: true });
      fs.copyFileSync(src, dest);
      fs.chmodSync(dest, 0o666);
    } catch (e) {
      log(`Sound sync error: ${e.message}`);
    }
  });
}

function updateConfigs() {
  log('Checking for data changes...');
  
  const extensions = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'extensions.json'), 'utf8') || '[]');
  const trunks = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'trunks.json'), 'utf8') || '[]');
  const queues = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'queues.json'), 'utf8') || '[]');
  const ivrs = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'ivrs.json'), 'utf8') || '[]');
  const routes = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'routes.json'), 'utf8') || '[]');

  // 1. PJSIP USERS
  let usersConf = '; MIAC PJSIP USERS\n[transport-udp-nat]\ntype=transport\nprotocol=udp\nbind=0.0.0.0:5060\n\n';
  extensions.forEach(ext => {
    usersConf += `[${ext.id}]\ntype=endpoint\ncontext=from-internal\ndisallow=all\nallow=ulaw,alaw,opus\nauth=auth-${ext.id}\naors=${ext.id}\nidentify_by=auth_username,username\nrtp_symmetric=yes\nforce_rport=yes\nrewrite_contact=yes\n\n`;
    usersConf += `[auth-${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
    usersConf += `[${ext.id}]\ntype=aor\nmax_contacts=2\n\n`;
  });
  fs.writeFileSync(CONFIG_FILES.users, usersConf);

  // 2. PJSIP TRUNKS
  let trunksConf = '; MIAC PJSIP TRUNKS\n';
  trunks.forEach(t => {
    trunksConf += `[registration-${t.id}]\ntype=registration\nserver_uri=sip:${t.host}:${t.port}\nclient_uri=sip:${t.user}@${t.host}:${t.port}\ncontact_user=${t.phone || t.user}\noutbound_auth=auth-${t.id}\n\n`;
    trunksConf += `[trunk-${t.id}]\ntype=endpoint\ncontext=from-trunk\ndisallow=all\nallow=alaw,ulaw\noutbound_auth=auth-${t.id}\naors=aor-${t.id}\n\n`;
    trunksConf += `[auth-${t.id}]\ntype=auth\nauth_type=userpass\nusername=${t.user}\npassword=${t.password}\n\n`;
    trunksConf += `[aor-${t.id}]\ntype=aor\ncontact=sip:${t.host}:${t.port}\n\n`;
  });
  fs.writeFileSync(CONFIG_FILES.trunks, trunksConf);

  // 3. QUEUES
  let queuesConf = '; MIAC QUEUES\n';
  queues.forEach(q => {
    queuesConf += `[${q.name}]\nstrategy=${q.strategy}\nmusicclass=${q.musicOnHoldClass || 'default'}\ntimeout=15\nretry=5\nwrapuptime=0\n`;
    (q.members || []).forEach(m => {
      queuesConf += `member => PJSIP/${m}\n`;
    });
    queuesConf += `\n`;
  });
  fs.writeFileSync(CONFIG_FILES.queues, queuesConf);

  // 4. DIALPLAN (EXTENSIONS)
  let dialplan = '[from-internal]\n';
  extensions.forEach(ext => {
    dialplan += `exten => ${ext.id},1,Dial(PJSIP/${ext.id},30)\n`;
  });

  // Входящие маршруты
  dialplan += '\n[from-trunk]\n';
  dialplan += 'exten => s,1,NoOp(Incoming call on S extension)\n';
  
  routes.forEach(r => {
    if (r.type === 'inbound') {
      const dest = r.destination.split(':');
      let target = '';
      if (dest[0] === 'Extension') target = `PJSIP/${dest[1]},30`;
      else if (dest[0] === 'Queue') target = `Queue(${dest[1]})`;
      else if (dest[0] === 'IVR') target = `Goto(miac-ivr-${dest[1]},s,1)`;
      
      dialplan += `exten => ${r.pattern},1,${dest[0] === 'IVR' ? target : `Dial(${target})`}\n`;
      // Если это первый маршрут, делаем его также для 's'
      if (routes.indexOf(r) === 0) {
        dialplan += `exten => s,n,${dest[0] === 'IVR' ? target : `Dial(${target})`}\n`;
      }
    }
  });

  // IVR Диалплан
  ivrs.forEach(ivr => {
    dialplan += `\n[miac-ivr-${ivr.id}]\n`;
    dialplan += `exten => s,1,Answer()\n`;
    dialplan += `same => n,Set(TIMEOUT(digit)=3)\n`;
    dialplan += `same => n,Background(${ivr.announcementFile})\n`;
    dialplan += `same => n,WaitExten(5)\n`;

    // Кнопки
    (ivr.digitMappings || []).forEach(m => {
      const [digit, type, target] = m.split(':');
      let action = '';
      if (type === 'ext') action = `Dial(PJSIP/${target},30)`;
      else if (type === 'queue') action = `Queue(${target})`;
      else if (type === 'ivr') action = `Goto(miac-ivr-${target},s,1)`;
      dialplan += `exten => ${digit},1,${action}\n`;
    });

    // Таймаут
    if (ivr.timeoutDestination) {
      const [type, target] = ivr.timeoutDestination.split(':');
      let tAction = 'Hangup()';
      if (type === 'Extension') tAction = `Dial(PJSIP/${target},30)`;
      else if (type === 'Queue') tAction = `Queue(${target})`;
      dialplan += `exten => t,1,${tAction}\n`;
    } else {
      dialplan += `exten => t,1,Hangup()\n`;
    }
    dialplan += `exten => i,1,Playback(invalid)\n`;
    dialplan += `same => n,Goto(s,1)\n`;
  });

  fs.writeFileSync(CONFIG_FILES.extensions, dialplan);
  
  syncSounds();
  reloadAsterisk();
}

// Watchers
const watchFiles = [
  path.join(DATA_DIR, 'extensions.json'),
  path.join(DATA_DIR, 'trunks.json'),
  path.join(DATA_DIR, 'queues.json'),
  path.join(DATA_DIR, 'ivrs.json'),
  path.join(DATA_DIR, 'routes.json')
];

watchFiles.forEach(file => {
  if (fs.existsSync(file)) {
    fs.watch(file, (event) => {
      if (event === 'change') updateConfigs();
    });
  }
});

// Периодическая проверка для новых звуков
setInterval(syncSounds, 10000);

updateConfigs();
log('Bridge started and watching for changes...');
