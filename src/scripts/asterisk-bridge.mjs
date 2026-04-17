
import fs from 'fs';
import path from 'path';

/**
 * Asterisk Bridge Script v3.0
 * Синхронизирует JSON-базу с конфигурационными файлами Asterisk.
 * Исправляет: No matching endpoint (identify), IVR IDs, Timeout logic.
 */

const DATA_DIR = path.join(process.cwd(), 'src/data');
const AST_DIR = '/etc/asterisk';

// Чтение данных
const read = (file) => {
  const p = path.join(DATA_DIR, `${file}.json`);
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, 'utf8'));
};

const extensions = read('extensions');
const trunks = read('trunks');
const routes = read('routes');
const ivrs = read('ivrs');
const queues = read('queues');

// 1. PJSIP Абоненты
let usersConf = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
extensions.forEach(e => {
  usersConf += `[${e.id}]\ntype=endpoint\ncontext=miac-internal\ndisallow=all\nallow=ulaw,alaw\nauth=auth-${e.id}\naors=aor-${e.id}\nidentify_by=auth_username,username\n\n`;
  usersConf += `[auth-${e.id}]\ntype=auth\nauth_type=userpass\nusername=${e.id}\npassword=${e.secret}\n\n`;
  usersConf += `[aor-${e.id}]\ntype=aor\nmax_contacts=5\nremove_existing=yes\n\n`;
});

// 2. PJSIP Транки
let trunksConf = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
trunks.forEach(t => {
  trunksConf += `[trunk-${t.id}]\ntype=endpoint\ncontext=from-trunk\ndisallow=all\nallow=ulaw,alaw\noutbound_auth=auth-${t.id}\naors=aor-${t.id}\n\n`;
  trunksConf += `[auth-${t.id}]\ntype=auth\nauth_type=userpass\nusername=${t.user}\npassword=${t.password}\n\n`;
  trunksConf += `[aor-${t.id}]\ntype=aor\ncontact=sip:${t.host}:${t.port}\n\n`;
  trunksConf += `[reg-${t.id}]\ntype=registration\nendpoint=trunk-${t.id}\noutbound_auth=auth-${t.id}\nserver_uri=sip:${t.host}:${t.port}\nclient_uri=sip:${t.user}@${t.host}:${t.port}\n\n`;
  trunksConf += `[identify-${t.id}]\ntype=identify\nendpoint=trunk-${t.id}\nmatch=${t.host}\n\n`;
});

// 3. Диалплан (IVR, Маршруты, Группы)
let dialplanConf = '[from-internal]\ninclude => miac-internal\n\n[miac-internal]\n';
extensions.forEach(e => {
  dialplanConf += `exten => ${e.id},1,Dial(PJSIP/${e.id},30)\nsame => n,Hangup()\n`;
});

// Группы
queues.forEach(q => {
  dialplanConf += `exten => ${q.name},1,Queue(${q.name})\nsame => n,Hangup()\n`;
});

// IVR
ivrs.forEach(ivr => {
  dialplanConf += `\n[miac-ivr-${ivr.id}]\nexten => s,1,Answer()\nsame => n,Wait(1)\nsame => n,Background(${ivr.announcementFile})\nsame => n,WaitExten(5)\n`;
  
  // Кнопки
  (ivr.digitMappings || []).forEach(m => {
    const [digit, type, target] = m.split(':');
    if (digit && target) {
      if (type === 'ext') dialplanConf += `exten => ${digit},1,Dial(PJSIP/${target},30)\n`;
      if (type === 'queue') dialplanConf += `exten => ${digit},1,Queue(${target})\n`;
      if (type === 'ivr') dialplanConf += `exten => ${digit},1,Goto(miac-ivr-${target},s,1)\n`;
    }
  });

  // Таймаут (Секретарь)
  if (ivr.timeoutDestination && ivr.timeoutDestination !== 'hangup') {
    const [type, target] = ivr.timeoutDestination.split(':');
    if (type === 'Extension') dialplanConf += `exten => t,1,Dial(PJSIP/${target},30)\n`;
    else if (type === 'Queue') dialplanConf += `exten => t,1,Queue(${target})\n`;
    else dialplanConf += `exten => t,1,Hangup()\n`;
  } else {
    dialplanConf += `exten => t,1,Hangup()\n`;
  }
  dialplanConf += `exten => i,1,Goto(s,1)\n`;
});

// Входящие из транка
dialplanConf += `\n[from-trunk]\n`;
routes.filter(r => r.type === 'inbound').forEach(r => {
  const dest = r.destination;
  let action = 'Hangup()';
  if (dest.startsWith('Extension:')) action = `Dial(PJSIP/${dest.split(':')[1]},30)`;
  else if (dest.startsWith('Queue:')) action = `Queue(${dest.split(':')[1]})`;
  else if (dest.startsWith('IVR:')) action = `Goto(miac-ivr-${dest.split(':')[1]},s,1)`;
  
  dialplanConf += `exten => ${r.pattern},1,${action}\n`;
  if (r.pattern === '*') dialplanConf += `exten => s,1,${action}\n`;
});

// Очереди
let queuesConf = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
queues.forEach(q => {
  queuesConf += `[${q.name}]\nstrategy=${q.strategy}\nmusicclass=${q.musicOnHoldClass || 'default'}\n`;
  (q.members || []).forEach(m => {
    queuesConf += `member => PJSIP/${m}\n`;
  });
  queuesConf += `\n`;
});

// Запись файлов
try {
  fs.writeFileSync(path.join(AST_DIR, 'pjsip_miac_users.conf'), usersConf);
  fs.writeFileSync(path.join(AST_DIR, 'pjsip_miac_trunks.conf'), trunksConf);
  fs.writeFileSync(path.join(AST_DIR, 'extensions_miac_dialplan.conf'), dialplanConf);
  fs.writeFileSync(path.join(AST_DIR, 'queues_miac.conf'), queuesConf);

  // Копирование звуков
  const soundsDir = path.join(process.cwd(), 'src/data/sounds');
  if (fs.existsSync(soundsDir)) {
    fs.readdirSync(soundsDir).forEach(file => {
      try {
        fs.copyFileSync(path.join(soundsDir, file), path.join('/var/lib/asterisk/sounds', file));
      } catch (e) {}
    });
  }

  console.log('[BRIDGE] Конфигурация Asterisk успешно обновлена.');
} catch (e) {
  console.error('[BRIDGE] Ошибка записи конфигов:', e.message);
}
