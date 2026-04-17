import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Пути к данным приложения
const PROJECT_ROOT = path.join(__dirname, '../..');
const DATA_DIR = path.join(PROJECT_ROOT, 'src/data');
const SOUNDS_DIR = path.join(DATA_DIR, 'sounds');

// Файлы данных (JSON)
const FILES = {
  extensions: path.join(DATA_DIR, 'extensions.json'),
  trunks: path.join(DATA_DIR, 'trunks.json'),
  routes: path.join(DATA_DIR, 'routes.json'),
  queues: path.join(DATA_DIR, 'queues.json'),
  ivrs: path.join(DATA_DIR, 'ivrs.json'),
};

// Пути к конфигам Asterisk
const ASTERISK_DIR = '/etc/asterisk';
const CONF_FILES = {
  users: path.join(ASTERISK_DIR, 'pjsip_miac_users.conf'),
  trunks: path.join(ASTERISK_DIR, 'pjsip_miac_trunks.conf'),
  queues: path.join(ASTERISK_DIR, 'queues_miac.conf'),
  dialplan: path.join(ASTERISK_DIR, 'extensions_miac_dialplan.conf'),
};

const ASTERISK_SOUNDS = '/var/lib/asterisk/sounds';

// Обеспечиваем наличие директорий
[DATA_DIR, SOUNDS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 [BRIDGE] Создана директория: ${dir}`);
  }
});

function runAsteriskCmd(cmd) {
  exec(`asterisk -rx "${cmd}"`, (error, stdout, stderr) => {
    if (error) console.error(`❌ [ASTERISK ERROR] ${cmd}:`, error.message);
    else console.log(`🔄 [ASTERISK] ${cmd}: OK`);
  });
}

function syncExtensions() {
  if (!fs.existsSync(FILES.extensions)) return;
  const data = JSON.parse(fs.readFileSync(FILES.extensions, 'utf8'));
  let conf = '; --- MIAC PBX GENERATED USERS ---\n\n';

  data.forEach(ext => {
    conf += `[${ext.id}]\ntype=endpoint\ncontext=${ext.context || 'from-internal'}\ndisallow=all\nallow=ulaw,alaw,g722\nauth=${ext.id}\naors=${ext.id}\n\n`;
    conf += `[${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
    conf += `[${ext.id}]\ntype=aor\nmax_contacts=1\n\n`;
  });

  fs.writeFileSync(CONF_FILES.users, conf);
  console.log(`✅ [BRIDGE] Обновлено абонентов: ${data.length}`);
  runAsteriskCmd('module reload res_pjsip.so');
}

function syncTrunks() {
  if (!fs.existsSync(FILES.trunks)) return;
  const data = JSON.parse(fs.readFileSync(FILES.trunks, 'utf8'));
  let conf = '; --- MIAC PBX GENERATED TRUNKS ---\n\n';

  data.forEach(t => {
    const transport = 'transport-udp-nat';
    conf += `[${t.id}]\ntype=registration\noutbound_auth=${t.id}\nserver_uri=sip:${t.host}:${t.port || 5060}\nclient_uri=sip:${t.user}@${t.host}:${t.port || 5060}\n\n`;
    conf += `[${t.id}]\ntype=auth\nauth_type=userpass\nusername=${t.user}\npassword=${t.password}\n\n`;
    conf += `[${t.id}]\ntype=endpoint\ncontext=from-trunk\ndisallow=all\nallow=ulaw,alaw\noutbound_auth=${t.id}\naors=${t.id}\ntransport=${transport}\n\n`;
    conf += `[${t.id}]\ntype=aor\ncontact=sip:${t.host}:${t.port || 5060}\n\n`;
    conf += `[${t.id}]\ntype=identify\nendpoint=${t.id}\nmatch=${t.host}\n\n`;
  });

  fs.writeFileSync(CONF_FILES.trunks, conf);
  console.log(`✅ [BRIDGE] Обновлено транков: ${data.length}`);
  runAsteriskCmd('module reload res_pjsip.so');
}

function syncDialplan() {
  const routes = fs.existsSync(FILES.routes) ? JSON.parse(fs.readFileSync(FILES.routes, 'utf8')) : [];
  const ivrs = fs.existsSync(FILES.ivrs) ? JSON.parse(fs.readFileSync(FILES.ivrs, 'utf8')) : [];
  
  let conf = '[from-internal]\n';
  conf += 'exten => _XXX,1,Dial(PJSIP/${EXTEN},30)\n';
  conf += 'same => n,Hangup()\n\n';

  // Исходящие маршруты
  routes.filter(r => r.type === 'outbound').forEach(r => {
    const trunkId = r.destination.replace('Trunk:', '');
    conf += `exten => ${r.pattern},1,Dial(PJSIP/\${EXTEN}@${trunkId})\n`;
    conf += `same => n,Hangup()\n`;
  });

  // Входящие маршруты
  conf += '\n[from-trunk]\n';
  routes.filter(r => r.type === 'inbound').forEach(r => {
    if (r.destination.startsWith('Extension:')) {
      const extId = r.destination.replace('Extension:', '');
      conf += `exten => ${r.pattern},1,Dial(PJSIP/${extId},30)\n`;
    } else if (r.destination.startsWith('Queue:')) {
      const qName = r.destination.replace('Queue:', '');
      conf += `exten => ${r.pattern},1,Queue(${qName})\n`;
    } else if (r.destination.startsWith('IVR:')) {
      const ivrId = r.destination.replace('IVR:', '');
      conf += `exten => ${r.pattern},1,Goto(ivr-${ivrId},s,1)\n`;
    }
    conf += `same => n,Hangup()\n`;
  });

  // IVR секции
  ivrs.forEach(ivr => {
    conf += `\n[ivr-${ivr.id}]\n`;
    conf += `exten => s,1,Answer()\n`;
    conf += `same => n,Background(${ivr.announcementFile})\n`;
    conf += `same => n,WaitExten(5)\n`;
    
    (ivr.digitMappings || []).forEach(m => {
      const [digit, type, target] = m.split(':');
      if (type === 'ext') conf += `exten => ${digit},1,Dial(PJSIP/${target},30)\n`;
      if (type === 'queue') conf += `exten => ${digit},1,Queue(${target})\n`;
      if (type === 'ivr') conf += `exten => ${digit},1,Goto(ivr-${target},s,1)\n`;
    });
    conf += `exten => t,1,Hangup()\n`;
    conf += `exten => i,1,Playback(invalid)\n`;
    conf += `same => n,Goto(s,1)\n`;
  });

  fs.writeFileSync(CONF_FILES.dialplan, conf);
  console.log('✅ [BRIDGE] Диалплан обновлен.');
  runAsteriskCmd('dialplan reload');
}

function syncQueues() {
  if (!fs.existsSync(FILES.queues)) return;
  const data = JSON.parse(fs.readFileSync(FILES.queues, 'utf8'));
  let conf = '; --- MIAC PBX GENERATED QUEUES ---\n\n';

  data.forEach(q => {
    conf += `[${q.name}]\nstrategy=${q.strategy || 'ringall'}\nmusicclass=${q.musicOnHoldClass || 'default'}\n`;
    (q.members || []).forEach(m => {
      conf += `member => PJSIP/${m}\n`;
    });
    conf += `\n`;
  });

  fs.writeFileSync(CONF_FILES.queues, conf);
  console.log(`✅ [BRIDGE] Обновлено очередей: ${data.length}`);
  runAsteriskCmd('module reload app_queue.so');
}

function syncSounds() {
  const files = fs.readdirSync(SOUNDS_DIR);
  files.forEach(file => {
    const src = path.join(SOUNDS_DIR, file);
    const dest = path.join(ASTERISK_SOUNDS, file);
    if (!fs.existsSync(dest)) {
      try {
        fs.copyFileSync(src, dest);
        fs.chmodSync(dest, 0o666);
        console.log(`🎵 [BRIDGE] Звуковой файл скопирован: ${file}`);
      } catch (e) {
        console.error(`❌ [BRIDGE] Ошибка копирования звука: ${e.message}`);
      }
    }
  });
}

// Запуск начальной синхронизации
console.log('🚀 [BRIDGE] Мост МИАЦ.СВЯЗЬ запущен...');
syncExtensions();
syncTrunks();
syncQueues();
syncDialplan();
syncSounds();

// Наблюдение за изменениями
fs.watch(DATA_DIR, (eventType, filename) => {
  if (!filename || !filename.endsWith('.json')) return;
  console.log(`📂 [BRIDGE] Изменение в ${filename}, синхронизация...`);
  if (filename === 'extensions.json') syncExtensions();
  if (filename === 'trunks.json') syncTrunks();
  if (filename === 'queues.json') syncQueues();
  if (filename === 'routes.json' || filename === 'ivrs.json') syncDialplan();
});

fs.watch(SOUNDS_DIR, (eventType, filename) => {
  if (filename) syncSounds();
});