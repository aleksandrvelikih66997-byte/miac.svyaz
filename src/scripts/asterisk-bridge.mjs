
/**
 * МИАЦ.СВЯЗЬ - Asterisk Configuration Bridge
 * Скрипт синхронизации данных из JSON в файлы конфигурации Asterisk (.conf)
 * Оптимизировано для Asterisk 17/20 и AltLinux SP 10
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

const DATA_DIR = path.resolve('src/data');
const SOUNDS_DIR = path.resolve('src/data/sounds');
const ASTERISK_DIR = '/etc/asterisk';
const ASTERISK_SOUNDS_DIR = '/var/lib/asterisk/sounds';

// Создаем необходимые папки, если их нет
[DATA_DIR, SOUNDS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

/**
 * Чтение JSON данных
 */
function readData(filename) {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`Ошибка чтения ${filename}:`, e);
    return [];
  }
}

/**
 * Генерация PJSIP абонентов
 */
function generatePjsipUsers() {
  const users = readData('extensions.json');
  let config = '; АВТОГЕНЕРАЦИЯ МИАЦ.СВЯЗЬ - АБОНЕНТЫ\n\n';

  users.forEach(u => {
    config += `[${u.id}]\ntype=endpoint\ncontext=from-internal\ndisallow=all\nallow=ulaw,alaw,g722\nauth=${u.id}\naors=${u.id}\n`;
    config += `rtp_symmetric=yes\nforce_rport=yes\nrewrite_contact=yes\ndirect_media=no\nidentify_by=username,auth_username\n\n`;
    
    config += `[${u.id}]\ntype=auth\nauth_type=userpass\npassword=${u.secret}\nusername=${u.id}\n\n`;
    
    config += `[${u.id}]\ntype=aor\nmax_contacts=1\nremove_existing=yes\n\n`;
  });

  fs.writeFileSync(path.join(ASTERISK_DIR, 'pjsip_miac_users.conf'), config);
}

/**
 * Генерация PJSIP транков
 */
function generatePjsipTrunks() {
  const trunks = readData('trunks.json');
  let config = '; АВТОГЕНЕРАЦИЯ МИАЦ.СВЯЗЬ - ТРАНКИ\n\n';

  trunks.forEach(t => {
    const authId = `${t.id}_auth`;
    
    // Регистрация на стороне провайдера
    config += `[${t.id}]\ntype=registration\ntransport=transport-udp-nat\noutbound_auth=${authId}\n`;
    config += `server_uri=sip:${t.host}${t.port ? ':' + t.port : ''}\n`;
    config += `client_uri=sip:${t.user}@${t.host}${t.port ? ':' + t.port : ''}\nretry_interval=60\n\n`;

    config += `[${authId}]\ntype=auth\nauth_type=userpass\npassword=${t.password}\nusername=${t.user}\n\n`;

    config += `[${t.id}]\ntype=aor\ncontact=sip:${t.host}${t.port ? ':' + t.port : ''}\n\n`;

    config += `[${t.id}]\ntype=endpoint\ncontext=from-external\ndisallow=all\nallow=ulaw,alaw\noutbound_auth=${authId}\naors=${t.id}\nidentify_by=username\n\n`;
  });

  fs.writeFileSync(path.join(ASTERISK_DIR, 'pjsip_miac_trunks.conf'), config);
}

/**
 * Генерация Диалплана
 */
function generateDialplan() {
  const extensions = readData('extensions.json');
  const routes = readData('routes.json');
  const queues = readData('queues.json');
  const ivrs = readData('ivrs.json');

  let config = '; АВТОГЕНЕРАЦИЯ МИАЦ.СВЯЗЬ - ДИАЛПЛАН\n\n';
  config += '[from-internal]\n';
  
  // Внутренняя связь
  extensions.forEach(e => {
    config += `exten => ${e.id},1,Dial(PJSIP/${e.id},30)\n`;
  });

  // Исходящие маршруты
  routes.filter(r => r.type === 'outbound').forEach(r => {
    const trunkId = r.destination.split(':')[1];
    config += `exten => _${r.pattern},1,Dial(PJSIP/\${EXTEN}@${trunkId},30)\n`;
  });

  // Входящий контекст
  config += '\n[from-external]\n';
  routes.filter(r => r.type === 'inbound').forEach(r => {
    const [type, id] = r.destination.split(':');
    if (type === 'Extension') config += `exten => ${r.pattern},1,Dial(PJSIP/${id},30)\n`;
    if (type === 'Queue') config += `exten => ${r.pattern},1,Queue(${id})\n`;
    if (type === 'IVR') config += `exten => ${r.pattern},1,Goto(ivr-${id},s,1)\n`;
  });

  // IVR контексты
  ivrs.forEach(ivr => {
    config += `\n[ivr-${ivr.id}]\nexten => s,1,Answer()\nsame => n,Background(${ivr.announcementFile})\nsame => n,WaitExten(5)\n`;
    (ivr.digitMappings || []).forEach(m => {
      const [digit, type, target] = m.split(':');
      if (type === 'ext') config += `exten => ${digit},1,Dial(PJSIP/${target},30)\n`;
      if (type === 'queue') config += `exten => ${digit},1,Queue(${target})\n`;
      if (type === 'ivr') config += `exten => ${digit},1,Goto(ivr-${target},s,1)\n`;
    });
  });

  fs.writeFileSync(path.join(ASTERISK_DIR, 'extensions_miac_dialplan.conf'), config);
}

/**
 * Синхронизация звуковых файлов
 */
function syncSounds() {
  if (!fs.existsSync(ASTERISK_SOUNDS_DIR)) return;
  const files = fs.readdirSync(SOUNDS_DIR);
  files.forEach(file => {
    const src = path.join(SOUNDS_DIR, file);
    const dest = path.join(ASTERISK_SOUNDS_DIR, file);
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(src, dest);
      fs.chmodSync(dest, 0o666);
      console.log(`[SOUNDS] Скопирован файл: ${file}`);
    }
  });
}

/**
 * Перезагрузка Asterisk
 */
async function reloadAsterisk() {
  try {
    await execPromise('asterisk -rx "pjsip reload"');
    await execPromise('asterisk -rx "dialplan reload"');
    await execPromise('asterisk -rx "queue reload all"');
    console.log('[ASTERISK] Конфигурация успешно перезагружена.');
  } catch (e) {
    console.warn('[ASTERISK] Предупреждение при перезагрузке (возможно Asterisk не запущен):', e.message);
  }
}

/**
 * Основной цикл
 */
async function syncAll() {
  console.log('[BRIDGE] Синхронизация...');
  generatePjsipUsers();
  generatePjsipTrunks();
  generateDialplan();
  syncSounds();
  await reloadAsterisk();
}

// Следим за изменениями
fs.watch(DATA_DIR, (eventType, filename) => {
  if (filename && filename.endsWith('.json')) {
    syncAll();
  }
});

// Первоначальный запуск
syncAll();
console.log('🚀 [BRIDGE] Мост МИАЦ.СВЯЗЬ запущен и следит за изменениями.');
