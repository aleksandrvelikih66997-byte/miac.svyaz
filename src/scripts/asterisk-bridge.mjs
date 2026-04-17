
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * МИАЦ.СВЯЗЬ - Скрипт синхронизации с Asterisk 17/20.
 * Слушает изменения в JSON файлах и генерирует .conf файлы.
 */

const DATA_DIR = path.join(process.cwd(), 'src/data');
const SOUNDS_DIR = path.join(DATA_DIR, 'sounds');
const ASTERISK_DIR = '/etc/asterisk';
const ASTERISK_SOUNDS_DIR = '/var/lib/asterisk/sounds';

// Создание папок если их нет
[DATA_DIR, SOUNDS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const FILES = {
  extensions: path.join(DATA_DIR, 'extensions.json'),
  trunks: path.join(DATA_DIR, 'trunks.json'),
  routes: path.join(DATA_DIR, 'routes.json'),
  queues: path.join(DATA_DIR, 'queues.json'),
  ivrs: path.join(DATA_DIR, 'ivrs.json'),
};

const OUTPUT = {
  users: path.join(ASTERISK_DIR, 'pjsip_miac_users.conf'),
  trunks: path.join(ASTERISK_DIR, 'pjsip_miac_trunks.conf'),
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
 * Генерация PJSIP Абонентов
 */
function generateUsers(exts) {
  let conf = '; Генерируемый файл пользователей МИАЦ\n\n';
  exts.forEach(ext => {
    conf += `[${ext.id}]\ntype=endpoint\ncontext=from-internal\ndisallow=all\nallow=ulaw,alaw,g722\nauth=auth-${ext.id}\naors=${ext.id}\n`;
    // Важно для Yealink и кривых From заголовков
    conf += `identify_by=auth_username,username\nrtp_symmetric=yes\nrewrite_contact=yes\n\n`;
    
    conf += `[auth-${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
    conf += `[${ext.id}]\ntype=aor\nmax_contacts=2\n\n`;
  });
  return conf;
}

/**
 * Генерация PJSIP Транков
 */
function generateTrunks(trunks) {
  let conf = '; Генерируемый файл транков МИАЦ\n\n';
  trunks.forEach(t => {
    conf += `[registration-${t.id}]\ntype=registration\nserver_uri=sip:${t.host}:${t.port}\nclient_uri=sip:${t.user}@${t.host}:${t.port}\noutbound_auth=auth-${t.id}\n\n`;
    
    conf += `[trunk-${t.id}]\ntype=endpoint\ncontext=from-trunk\ndisallow=all\nallow=ulaw,alaw\noutbound_auth=auth-${t.id}\naors=aor-${t.id}\n\n`;
    
    conf += `[auth-${t.id}]\ntype=auth\nauth_type=userpass\nusername=${t.user}\npassword=${t.password}\n\n`;
    
    conf += `[aor-${t.id}]\ntype=aor\ncontact=sip:${t.host}:${t.port}\n\n`;
    
    conf += `[identify-${t.id}]\ntype=identify\nendpoint=trunk-${t.id}\nmatch=${t.host}\n\n`;
  });
  return conf;
}

/**
 * Генерация Очередей
 */
function generateQueues(queues) {
  let conf = '; Генерируемый файл очередей МИАЦ\n\n';
  queues.forEach(q => {
    conf += `[${q.name}]\nstrategy=${q.strategy}\nmusicclass=${q.musicOnHoldClass || 'default'}\n`;
    (q.members || []).forEach(m => {
      conf += `member => PJSIP/${m}\n`;
    });
    conf += `\n`;
  });
  return conf;
}

/**
 * Генерация Dialplan (Extensions)
 */
function generateDialplan() {
  const routes = readJSON(FILES.routes);
  const exts = readJSON(FILES.extensions);
  const ivrs = readJSON(FILES.ivrs);
  const queues = readJSON(FILES.queues);

  let conf = '; Генерируемый файл диалплана МИАЦ\n\n';

  // Внутренняя связь
  conf += `[from-internal]\n`;
  exts.forEach(e => {
    conf += `exten => ${e.id},1,NoOp(Call to ${e.name})\nsame => n,Dial(PJSIP/${e.id},30)\nsame => n,Hangup()\n`;
  });

  // Исходящая маршрутизация
  routes.filter(r => r.type === 'outbound').forEach(r => {
    const trunkId = r.destination.split(':')[1];
    conf += `exten => _${r.pattern},1,NoOp(Outbound via ${trunkId})\nsame => n,Dial(PJSIP/\${EXTEN}@trunk-${trunkId})\nsame => n,Hangup()\n`;
  });

  // Входящая маршрутизация
  conf += `\n[from-trunk]\n`;
  
  // Обработка стандартного экстеншена 's', если провайдер не шлет DID
  const firstInbound = routes.find(r => r.type === 'inbound');
  if (firstInbound) {
    conf += `exten => s,1,NoOp(Standard Inbound Call S)\nsame => n,Goto(from-trunk,${firstInbound.pattern},1)\n`;
  }

  routes.filter(r => r.type === 'inbound').forEach(r => {
    const [type, target] = r.destination.split(':');
    conf += `exten => ${r.pattern},1,NoOp(Inbound Call for ${r.pattern})\n`;
    if (type === 'Extension') conf += `same => n,Dial(PJSIP/${target},30)\n`;
    if (type === 'Queue') conf += `same => n,Queue(${target})\n`;
    if (type === 'IVR') conf += `same => n,Goto(ivr-${target},s,1)\n`;
    conf += `same => n,Hangup()\n`;
  });

  // IVR Диалплан
  ivrs.forEach(ivr => {
    conf += `\n[ivr-${ivr.id}]\nexten => s,1,Answer()\nsame => n,Wait(1)\nsame => n,Background(${ivr.announcementFile})\nsame => n,WaitExten(5)\n`;
    (ivr.digitMappings || []).forEach(m => {
      const [digit, type, target] = m.split(':');
      if (type === 'ext') conf += `exten => ${digit},1,Dial(PJSIP/${target},30)\n`;
      if (type === 'queue') conf += `exten => ${digit},1,Queue(${target})\n`;
      if (type === 'ivr') conf += `exten => ${digit},1,Goto(ivr-${target},s,1)\n`;
    });
    conf += `exten => t,1,Hangup()\nexten => i,1,Playback(invalid)\nsame => n,Goto(s,1)\n`;
  });

  return conf;
}

/**
 * Основной цикл синхронизации
 */
async function sync() {
  console.log('🚀 [BRIDGE] Синхронизация данных с Asterisk...');
  
  try {
    const usersConf = generateUsers(readJSON(FILES.extensions));
    const trunksConf = generateTrunks(readJSON(FILES.trunks));
    const queuesConf = generateQueues(readJSON(FILES.queues));
    const dialplanConf = generateDialplan();

    fs.writeFileSync(OUTPUT.users, usersConf);
    fs.writeFileSync(OUTPUT.trunks, trunksConf);
    fs.writeFileSync(OUTPUT.queues, queuesConf);
    fs.writeFileSync(OUTPUT.dialplan, dialplanConf);

    // Применение настроек в Asterisk
    await execAsync('asterisk -rx "pjsip reload"');
    await execAsync('asterisk -rx "dialplan reload"');
    await execAsync('asterisk -rx "queue reload all"');
    
    console.log('✅ [BRIDGE] Конфигурация успешно обновлена и применена.');
  } catch (err) {
    console.error('❌ [BRIDGE] Ошибка при синхронизации:', err.message);
  }
}

// Слежение за звуками
if (fs.existsSync(SOUNDS_DIR)) {
  fs.watch(SOUNDS_DIR, (event, filename) => {
    if (filename) {
       const src = path.join(SOUNDS_DIR, filename);
       const dest = path.join(ASTERISK_SOUNDS_DIR, filename);
       if (fs.existsSync(src)) {
         console.log(`🎵 [BRIDGE] Синхронизация аудио: ${filename}`);
         fs.copyFileSync(src, dest);
         fs.chmodSync(dest, 0o666);
       }
    }
  });
}

// Слежение за данными
fs.watch(DATA_DIR, (event, filename) => {
  if (filename && filename.endsWith('.json')) {
    sync();
  }
});

console.log('🌟 [BRIDGE] Мост МИАЦ.СВЯЗЬ запущен и активен.');
sync();
