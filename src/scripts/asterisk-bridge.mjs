/**
 * @fileOverview Профессиональный мост синхронизации МИАЦ.СВЯЗЬ с Asterisk 17/20.
 * Синхронизирует: Абонентов (PJSIP), Транки (PJSIP), Диалплан (extensions) и Статусы.
 */

import fs from 'fs';
import path from 'path';
import asterisk from 'asterisk-manager';
import dotenv from 'dotenv';

dotenv.config();

const DATA_DIR = path.join(process.cwd(), 'src/data');
const AST_DIR = '/etc/asterisk';

// Проверяем наличие директории Asterisk. Если нет - работаем в локальной папке для теста.
const TARGET_AST_DIR = fs.existsSync(AST_DIR) ? AST_DIR : path.join(process.cwd(), 'asterisk_mock');
if (!fs.existsSync(TARGET_AST_DIR)) fs.mkdirSync(TARGET_AST_DIR, { recursive: true });

const AST_FILES = {
  users: path.join(TARGET_AST_DIR, 'pjsip_miac_users.conf'),
  trunks: path.join(TARGET_AST_DIR, 'pjsip_miac_trunks.conf'),
  dialplan: path.join(TARGET_AST_DIR, 'extensions_miac_dialplan.conf'),
};

const aml = new asterisk(5038, '127.0.0.1', 'miac', 'MiacAMI2026', true);

function readJSON(filename) {
  const file = path.join(DATA_DIR, filename);
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return [];
  }
}

function writeJSON(filename, data) {
  const file = path.join(DATA_DIR, filename);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

async function syncAll() {
  console.log('🔄 [BRIDGE] Начало синхронизации...');
  
  const extensions = readJSON('extensions.json');
  const trunks = readJSON('trunks.json');
  const routes = readJSON('routes.json');
  const queues = readJSON('queues.json');
  const ivrs = readJSON('ivrs.json');

  // 1. Синхронизация абонентов
  let usersConf = '; ГЕНЕРИРУЕМЫЙ ФАЙЛ МИАЦ.СВЯЗЬ - АБОНЕНТЫ\n\n';
  extensions.forEach(ext => {
    usersConf += `[${ext.id}](transport-udp-nat)\ntype=endpoint\nauth=${ext.id}\naors=${ext.id}\ncontext=from-internal\ndisallow=all\nallow=ulaw,alaw\ndirect_media=no\n\n`;
    usersConf += `[${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
    usersConf += `[${ext.id}]\ntype=aor\nmax_contacts=1\nremove_existing=yes\n\n`;
  });
  fs.writeFileSync(AST_FILES.users, usersConf);

  // 2. Синхронизация транков
  let trunksConf = '; ГЕНЕРИРУЕМЫЙ ФАЙЛ МИАЦ.СВЯЗЬ - ТРАНКИ\n\n';
  trunks.forEach(t => {
    const trunkId = t.id;
    trunksConf += `[${trunkId}-reg]\ntype=registration\ntransport=transport-udp-nat\noutbound_auth=${trunkId}\nserver_uri=sip:${t.host}:${t.port}\nclient_uri=sip:${t.user}@${t.host}:${t.port}\nretry_interval=60\n\n`;
    trunksConf += `[${trunkId}]\ntype=auth\nauth_type=userpass\nusername=${t.user}\npassword=${t.password}\n\n`;
    trunksConf += `[${trunkId}](transport-udp-nat)\ntype=endpoint\ncontext=from-trunk\ndisallow=all\nallow=ulaw,alaw\noutbound_auth=${trunkId}\naors=${trunkId}\n\n`;
    trunksConf += `[${trunkId}]\ntype=aor\ncontact=sip:${t.host}:${t.port}\n\n`;
    trunksConf += `[${trunkId}]\ntype=identify\nendpoint=${trunkId}\nmatch=${t.host}\n\n`;
  });
  fs.writeFileSync(AST_FILES.trunks, trunksConf);

  // 3. Синхронизация диалплана
  let dialplanConf = '; ГЕНЕРИРУЕМЫЙ ФАЙЛ МИАЦ.СВЯЗЬ - ДИАЛПЛАН\n\n[from-internal]\n';
  // Внутренние звонки
  dialplanConf += 'exten => _XXX,1,Dial(PJSIP/${EXTEN},30)\n';
  dialplanConf += 'same => n,Hangup()\n\n';

  // Исходящие маршруты
  routes.filter(r => r.type === 'outbound').forEach(route => {
    const trunkId = route.destination.replace('Trunk:', '');
    dialplanConf += `exten => ${route.pattern},1,Log(NOTICE, Outbound call via ${trunkId})\n`;
    dialplanConf += `same => n,Dial(PJSIP/\${EXTEN}@${trunkId},60)\n`;
    dialplanConf += `same => n,Hangup()\n\n`;
  });

  // Входящие маршруты
  dialplanConf += '[from-trunk]\n';
  routes.filter(r => r.type === 'inbound').forEach(route => {
    const dest = route.destination;
    if (dest.startsWith('Extension:')) {
      const extId = dest.split(':')[1];
      dialplanConf += `exten => ${route.pattern},1,Dial(PJSIP/${extId},30)\n`;
    } else if (dest.startsWith('Queue:')) {
      const qName = dest.split(':')[1];
      dialplanConf += `exten => ${route.pattern},1,Queue(${qName})\n`;
    } else if (dest.startsWith('IVR:')) {
      const ivrId = dest.split(':')[1];
      dialplanConf += `exten => ${route.pattern},1,Goto(ivr-${ivrId},s,1)\n`;
    }
    dialplanConf += `same => n,Hangup()\n\n`;
  });

  // Очереди
  let queuesConf = '; Настройки очередей Asterisk (queues.conf)\n';
  queues.forEach(q => {
    dialplanConf += `[queue-${q.name}]\n`;
    q.members.forEach(m => {
      dialplanConf += `exten => s,n,Dial(PJSIP/${m},10)\n`;
    });
    dialplanConf += `same => n,Hangup()\n\n`;
  });

  // IVR Секции
  ivrs.forEach(ivr => {
    dialplanConf += `[ivr-${ivr.id}]\n`;
    dialplanConf += `exten => s,1,Answer()\n`;
    dialplanConf += `same => n,Background(${ivr.announcementFile})\n`;
    dialplanConf += `same => n,WaitExten(5)\n\n`;
    (ivr.digitMappings || []).forEach(mapping => {
      const [digit, type, target] = mapping.split(':');
      if (type === 'ext') dialplanConf += `exten => ${digit},1,Dial(PJSIP/${target},30)\n`;
      if (type === 'queue') dialplanConf += `exten => ${digit},1,Queue(${target})\n`;
    });
    dialplanConf += `exten => t,1,Hangup()\n`;
    dialplanConf += `exten => i,1,Playback(invalid)\n`;
    dialplanConf += `same => n,Goto(s,1)\n\n`;
  });

  fs.writeFileSync(AST_FILES.dialplan, dialplanConf);

  console.log(`✅ [BRIDGE] Файлы обновлены. Абонентов: ${extensions.length}, Транков: ${trunks.length}`);

  // Перезагрузка модулей
  const commands = ['module reload res_pjsip.so', 'dialplan reload'];
  for (const cmd of commands) {
    aml.action({ action: 'Command', command: cmd }, (err, res) => {
      if (!err && res.response !== 'Error') {
        console.log(`🔄 [BRIDGE] Asterisk Command (${cmd}): OK`);
      } else {
        console.log(`❌ [BRIDGE] AMI Error on ${cmd}: ${err?.message || res?.message}`);
      }
    });
  }
}

// Обновление статусов
async function updateStatuses() {
  aml.action({ action: 'PJSIPShowEndpoints' }, (err, res) => {
    if (err) return;
    const extensions = readJSON('extensions.json');
    let changed = false;

    // В реальном AMI ответ приходит событиями, упростим логику
    // В данном прототипе мы просто имитируем опрос
    extensions.forEach(ext => {
      // Здесь должна быть логика парсинга ответа AMI
    });
  });
}

// Запуск
aml.on('managerevent', (evt) => {
  if (evt.event === 'PeerStatus' || evt.event === 'EndpointDetail') {
    // Реакция на изменение статуса
  }
});

syncAll();
setInterval(syncAll, 10000); // Синхронизация конфигов раз в 10 секунд
setInterval(updateStatuses, 5000); // Опрос статусов раз в 5 секунд

console.log('🚀 [BRIDGE] Мост МИАЦ.СВЯЗЬ запущен...');
console.log(`📂 [BRIDGE] Директория Asterisk: ${TARGET_AST_DIR}`);
