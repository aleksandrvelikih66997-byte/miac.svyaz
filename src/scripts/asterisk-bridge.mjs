
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

/**
 * МИАЦ.СВЯЗЬ - Asterisk Bridge Script
 * Этот скрипт следит за JSON-файлами и генерирует конфиги для Asterisk.
 */

const DATA_DIR = path.join(process.cwd(), 'src/data');
const SOUNDS_DIR = path.join(DATA_DIR, 'sounds');
const ASTERISK_DIR = '/etc/asterisk';
const ASTERISK_SOUNDS_DIR = '/var/lib/asterisk/sounds/ru'; // Или /var/lib/asterisk/sounds/

// Создание папок если нет
if (!fs.existsSync(SOUNDS_DIR)) fs.mkdirSync(SOUNDS_DIR, { recursive: true });

const FILES = {
  extensions: path.join(DATA_DIR, 'extensions.json'),
  trunks: path.join(DATA_DIR, 'trunks.json'),
  routes: path.join(DATA_DIR, 'routes.json'),
  queues: path.join(DATA_DIR, 'queues.json'),
  ivrs: path.join(DATA_DIR, 'ivrs.json'),
};

const TARGETS = {
  pjsip_users: path.join(ASTERISK_DIR, 'pjsip_miac_users.conf'),
  pjsip_trunks: path.join(ASTERISK_DIR, 'pjsip_miac_trunks.conf'),
  queues: path.join(ASTERISK_DIR, 'queues_miac.conf'),
  dialplan: path.join(ASTERISK_DIR, 'extensions_miac_dialplan.conf'),
};

function readJSON(file) {
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return [];
  }
}

/**
 * ГЕНЕРАЦИЯ PJSIP АБОНЕНТОВ
 */
function generateUsers() {
  const users = readJSON(FILES.extensions);
  let conf = '';

  users.forEach(u => {
    conf += `[${u.id}]\ntype=endpoint\ncontext=${u.context || 'from-internal'}\ndisallow=all\nallow=ulaw,alaw\nauth=auth-${u.id}\naors=${u.id}\n`;
    conf += `identify_by=auth_username,username\nrtp_symmetric=yes\nrewrite_contact=yes\n\n`;
    conf += `[auth-${u.id}]\ntype=auth\nauth_type=userpass\nusername=${u.id}\npassword=${u.secret}\n\n`;
    conf += `[${u.id}]\ntype=aor\nmax_contacts=5\nremove_existing=yes\n\n`;
  });

  fs.writeFileSync(TARGETS.pjsip_users, conf);
  console.log('[BRIDGE] Обновлен pjsip_miac_users.conf');
}

/**
 * ГЕНЕРАЦИЯ PJSIP ТРАНКОВ
 */
function generateTrunks() {
  const trunks = readJSON(FILES.trunks);
  let conf = '';

  trunks.forEach(t => {
    const trunkId = `trunk-${t.id}`;
    conf += `[registration-${t.id}]\ntype=registration\nserver_uri=sip:${t.host}:${t.port}\n`;
    conf += `client_uri=sip:${t.user}@${t.host}:${t.port}\noutbound_auth=auth-${t.id}\n\n`;

    conf += `[auth-${t.id}]\ntype=auth\nauth_type=userpass\nusername=${t.user}\npassword=${t.password}\n\n`;

    conf += `[${trunkId}]\ntype=endpoint\ncontext=from-trunk\ndisallow=all\nallow=ulaw,alaw\n`;
    conf += `outbound_auth=auth-${t.id}\naors=aor-${t.id}\nidentify_by=username\n\n`;

    conf += `[aor-${t.id}]\ntype=aor\ncontact=sip:${t.host}:${t.port}\n\n`;

    conf += `[identify-${t.id}]\ntype=identify\nendpoint=${trunkId}\nmatch=${t.host}\n\n`;
  });

  fs.writeFileSync(TARGETS.pjsip_trunks, conf);
  console.log('[BRIDGE] Обновлен pjsip_miac_trunks.conf');
}

/**
 * ГЕНЕРАЦИЯ ОЧЕРЕДЕЙ
 */
function generateQueues() {
  const queues = readJSON(FILES.queues);
  let conf = '';

  queues.forEach(q => {
    conf += `[${q.name}]\ntype=queue\nstrategy=${q.strategy}\nmusicclass=${q.musicOnHoldClass || 'default'}\n`;
    (q.members || []).forEach(m => {
      conf += `member => PJSIP/${m}\n`;
    });
    conf += `\n`;
  });

  fs.writeFileSync(TARGETS.queues, conf);
  console.log('[BRIDGE] Обновлен queues_miac.conf');
}

/**
 * ГЕНЕРАЦИЯ DIALPLAN (Маршруты + IVR)
 */
function generateDialplan() {
  const routes = readJSON(FILES.routes);
  const ivrs = readJSON(FILES.ivrs);
  const extensions = readJSON(FILES.extensions);
  
  let conf = '[from-internal]\n';
  
  // Внутренняя связь
  extensions.forEach(e => {
    conf += `exten => ${e.id},1,Dial(PJSIP/${e.id},30)\n`;
  });

  // Исходящая маршрутизация
  routes.filter(r => r.type === 'outbound').forEach(r => {
    const trunkId = r.destination.split(':')[1];
    conf += `exten => _${r.pattern},1,NoOp(Outbound call via ${trunkId})\n`;
    conf += `same => n,Dial(PJSIP/\${EXTEN}@trunk-${trunkId})\n`;
  });

  // Контекст для входящих вызовов
  conf += '\n[from-trunk]\n';
  
  // Обработка конкретных DID и "s"
  const inboundRoutes = routes.filter(r => r.type === 'inbound');
  inboundRoutes.forEach(r => {
    const [destType, destId] = r.destination.split(':');
    const asteriskDest = getAsteriskDest(destType, destId);
    
    // Если паттерн "." или "s", вешаем на "s" и на заплатку
    if (r.pattern === '.' || r.pattern === 's') {
      conf += `exten => s,1,NoOp(Inbound call to s)\n`;
      conf += `same => n,${asteriskDest}\n`;
    } else {
      conf += `exten => ${r.pattern},1,NoOp(Inbound call to ${r.pattern})\n`;
      conf += `same => n,${asteriskDest}\n`;
    }
  });
  
  // Если маршрутов нет, звонок на "s" уходит в пустоту - добавим заглушку
  if (inboundRoutes.length === 0) {
    conf += `exten => s,1,Hangup()\n`;
  }

  // ГЕНЕРАЦИЯ КОНТЕКСТОВ IVR
  ivrs.forEach(ivr => {
    conf += `\n[miac-ivr-${ivr.id}]\n`;
    conf += `exten => s,1,Answer()\n`;
    conf += `same => n,Set(TIMEOUT(digit)=3)\n`;
    conf += `same => n,Background(${ivr.announcementFile})\n`;
    conf += `same => n,WaitExten(5)\n`;
    conf += `same => n,Playback(vm-goodbye)\n`;
    conf += `same => n,Hangup()\n`;

    (ivr.digitMappings || []).forEach(m => {
      const [digit, type, target] = m.split(':');
      const dest = getAsteriskDest(type === 'ext' ? 'Extension' : type === 'queue' ? 'Queue' : 'IVR', target);
      conf += `exten => ${digit},1,NoOp(IVR ${ivr.name} press ${digit})\n`;
      conf += `same => n,${dest}\n`;
    });
    
    // Обработка таймаута и неверного ввода в IVR
    conf += `exten => i,1,Playback(invalid)\n`;
    conf += `same => n,Goto(s,1)\n`;
    conf += `exten => t,1,Playback(vm-goodbye)\n`;
    conf += `same => n,Hangup()\n`;
  });

  fs.writeFileSync(TARGETS.dialplan, conf);
  console.log('[BRIDGE] Обновлен extensions_miac_dialplan.conf');
}

function getAsteriskDest(type, id) {
  if (type === 'Extension') return `Dial(PJSIP/${id},30)`;
  if (type === 'Queue') return `Queue(${id})`;
  if (type === 'IVR') return `Goto(miac-ivr-${id},s,1)`;
  return 'Hangup()';
}

/**
 * СИНХРОНИЗАЦИЯ ЗВУКОВ
 */
function syncSounds() {
  if (!fs.existsSync(SOUNDS_DIR)) return;
  const files = fs.readdirSync(SOUNDS_DIR);
  
  files.forEach(file => {
    const src = path.join(SOUNDS_DIR, file);
    const dest = path.join(ASTERISK_SOUNDS_DIR, file);
    
    try {
      if (!fs.existsSync(ASTERISK_SOUNDS_DIR)) {
        fs.mkdirSync(ASTERISK_SOUNDS_DIR, { recursive: true });
      }
      fs.copyFileSync(src, dest);
      fs.chmodSync(dest, 0o666);
    } catch (e) {
      console.error(`[BRIDGE] Ошибка копирования звука ${file}:`, e.message);
    }
  });
}

/**
 * ПЕРЕЗАГРУЗКА ASTERISK
 */
function reloadAsterisk() {
  exec('asterisk -rx "core reload"', (err) => {
    if (err) console.error('[BRIDGE] Ошибка перезагрузки Asterisk:', err.message);
    else console.log('[BRIDGE] Asterisk перегружен');
  });
}

function updateAll() {
  try {
    generateUsers();
    generateTrunks();
    generateQueues();
    generateDialplan();
    syncSounds();
    reloadAsterisk();
  } catch (e) {
    console.error('[BRIDGE] Ошибка обновления:', e.message);
  }
}

// Слежение за изменениями
console.log('🚀 [BRIDGE] Мост МИАЦ.СВЯЗЬ запущен...');
updateAll();

const watcher = (event, filename) => {
  if (filename && filename.endsWith('.json')) {
    console.log(`[BRIDGE] Изменен файл: ${filename}`);
    updateAll();
  }
};

fs.watch(DATA_DIR, watcher);
fs.watch(SOUNDS_DIR, (event, filename) => {
  console.log(`[BRIDGE] Изменены звуки: ${filename}`);
  syncSounds();
  reloadAsterisk();
});
