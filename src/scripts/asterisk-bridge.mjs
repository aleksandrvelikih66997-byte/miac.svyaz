
import fs from 'fs';
import path from 'path';

/**
 * Скрипт синхронизации данных МИАЦ.СВЯЗЬ с конфигами Asterisk.
 * Создает pjsip_miac_users.conf, pjsip_miac_trunks.conf, queues_miac.conf 
 * и extensions_miac_dialplan.conf.
 */

const DATA_DIR = path.join(process.cwd(), 'src/data');
const AST_DIR = '/etc/asterisk';

// Чтение данных из JSON
const getJSON = (file) => {
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, 'utf8'));
};

const extensions = getJSON('extensions.json');
const trunks = getJSON('trunks.json');
const routes = getJSON('routes.json');
const queues = getJSON('queues.json');
const ivrs = getJSON('ivrs.json');

console.log(`[BRIDGE] Найдено: ${extensions.length} аб., ${trunks.length} тр., ${ivrs.length} IVR.`);

// 1. АБОНЕНТЫ (PJSIP)
let usersConf = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
extensions.forEach(ext => {
  usersConf += `[${ext.id}]\ntype=endpoint\nauth=auth-${ext.id}\naors=${ext.id}\ncontext=miac-internal\ndisallow=all\nallow=ulaw,alaw\ndirect_media=no\nidentify_by=auth_username,username\n\n`;
  usersConf += `[auth-${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
  usersConf += `[${ext.id}]\ntype=aor\nmax_contacts=5\nremove_existing=yes\n\n`;
});

// 2. ТРАНКИ (PJSIP)
let trunksConf = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
trunks.forEach(t => {
  trunksConf += `[trunk-${t.id}]\ntype=endpoint\ncontext=from-trunk\ndisallow=all\nallow=ulaw,alaw\noutbound_auth=auth-${t.id}\naors=aor-${t.id}\n\n`;
  trunksConf += `[auth-${t.id}]\ntype=auth\nauth_type=userpass\nusername=${t.user}\npassword=${t.password}\n\n`;
  trunksConf += `[aor-${t.id}]\ntype=aor\ncontact=sip:${t.host}:${t.port}\n\n`;
  trunksConf += `[reg-${t.id}]\ntype=registration\nendpoint=trunk-${t.id}\noutbound_auth=auth-${t.id}\nserver_uri=sip:${t.host}:${t.port}\nclient_uri=sip:${t.user}@${t.host}:${t.port}\n\n`;
  trunksConf += `[identify-${t.id}]\ntype=identify\nendpoint=trunk-${t.id}\nmatch=${t.host}\n\n`;
});

// 3. ОЧЕРЕДИ
let queuesConf = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
queues.forEach(q => {
  queuesConf += `[${q.name}]\nstrategy=${q.strategy}\nmusicclass=${q.musicOnHoldClass || 'default'}\ntimeout=20\nretry=5\nwrapuptime=10\n`;
  (q.members || []).forEach(m => {
    queuesConf += `member => PJSIP/${m}\n`;
  });
  queuesConf += `\n`;
});

// 4. DIALPLAN (extensions)
let dialplanConf = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n[miac-internal]\n';
// Внутренние звонки
dialplanConf += 'exten => _XXX,1,Dial(PJSIP/${EXTEN},30)\nexten => _XXX,n,Hangup()\n\n';

// Генерация контекстов IVR
ivrs.forEach(ivr => {
  dialplanConf += `[miac-ivr-${ivr.id}]\n`;
  dialplanConf += `exten => s,1,Answer()\n`;
  dialplanConf += `same => n,Background(${ivr.announcementFile})\n`;
  dialplanConf += `same => n,WaitExten(5)\n`;
  
  // Кнопки
  (ivr.digitMappings || []).forEach(m => {
    const [digit, type, target] = m.split(':');
    if (type === 'ext') dialplanConf += `exten => ${digit},1,Dial(PJSIP/${target},30)\n`;
    if (type === 'queue') dialplanConf += `exten => ${digit},1,Queue(${target})\n`;
    if (type === 'ivr') dialplanConf += `exten => ${digit},1,Goto(miac-ivr-${target},s,1)\n`;
  });

  // Таймаут (перевод на секретаря/цель)
  if (ivr.timeoutDestination) {
    const [tType, tTarget] = ivr.timeoutDestination.split(':');
    if (tType === 'Extension') dialplanConf += `exten => t,1,Dial(PJSIP/${tTarget},30)\n`;
    else if (tType === 'Queue') dialplanConf += `exten => t,1,Queue(${tTarget})\n`;
    else dialplanConf += `exten => t,1,Hangup()\n`;
  } else {
    dialplanConf += `exten => t,1,Hangup()\n`;
  }
  dialplanConf += `exten => i,1,Playback(invalid)\nexten => i,n,Goto(s,1)\n\n`;
});

// Входящая маршрутизация (from-trunk)
dialplanConf += `[from-trunk]\n`;
routes.filter(r => r.type === 'inbound').forEach(r => {
  const target = r.destination.split(':');
  if (target[0] === 'IVR') {
    dialplanConf += `exten => ${r.pattern},1,Goto(miac-ivr-${target[1]},s,1)\n`;
    dialplanConf += `exten => s,1,Goto(miac-ivr-${target[1]},s,1)\n`;
  } else if (target[0] === 'Extension') {
    dialplanConf += `exten => ${r.pattern},1,Dial(PJSIP/${target[1]},30)\n`;
    dialplanConf += `exten => s,1,Dial(PJSIP/${target[1]},30)\n`;
  }
});

// Запись в файлы
const safeWrite = (name, content) => {
  const p = path.join(AST_DIR, name);
  try {
    fs.writeFileSync(p, content);
    console.log(`[BRIDGE] Файл обновлен: ${p}`);
  } catch (e) {
    console.warn(`[BRIDGE] Ошибка записи ${p}: ${e.message}`);
    // Если прав нет, пишем в текущую папку для теста
    fs.writeFileSync(name, content);
  }
};

safeWrite('pjsip_miac_users.conf', usersConf);
safeWrite('pjsip_miac_trunks.conf', trunksConf);
safeWrite('queues_miac.conf', queuesConf);
safeWrite('extensions_miac_dialplan.conf', dialplanConf);

console.log('[BRIDGE] Синхронизация завершена. Выполните: asterisk -rx "core reload"');
