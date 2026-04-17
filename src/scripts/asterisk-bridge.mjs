
/**
 * МИАЦ.СВЯЗЬ — Asterisk Bridge
 * Скрипт синхронизации базы данных JSON с конфигурационными файлами Asterisk.
 * Оптимизировано для Asterisk 17/20, AltLinux SP 10.
 */

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'src/data');
const AST_CONF_DIR = '/etc/asterisk';

// Пути к генерируемым файлам
const FILES = {
  users: path.join(AST_CONF_DIR, 'pjsip_miac_users.conf'),
  trunks: path.join(AST_CONF_DIR, 'pjsip_miac_trunks.conf'),
  queues: path.join(AST_CONF_DIR, 'queues_miac.conf'),
  dialplan: path.join(AST_CONF_DIR, 'extensions_miac_dialplan.conf'),
};

// Загрузка данных
function loadData(file) {
  const filePath = path.join(DATA_DIR, file);
  if (!fs.existsSync(filePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`Ошибка чтения ${file}:`, e);
    return [];
  }
}

async function sync() {
  console.log('--- Начинаю синхронизацию МИАЦ.СВЯЗЬ ---');

  const extensions = loadData('extensions.json');
  const trunks = loadData('trunks.json');
  const queues = loadData('queues.json');
  const routes = loadData('routes.json');
  const ivrs = loadData('ivrs.json');

  // 1. СИНХРОНИЗАЦИЯ АБОНЕНТОВ (Users)
  let usersConf = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
  extensions.forEach(ext => {
    usersConf += `[${ext.id}]\ntype=endpoint\ncontext=miac-internal\ndisallow=all\nallow=ulaw,alaw\nauth=auth-${ext.id}\naors=${ext.id}\n`;
    usersConf += `identify_by=auth_username,username\n\n`; // Позволяет Yealink работать корректно
    
    usersConf += `[auth-${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
    usersConf += `[${ext.id}]\ntype=aor\nmax_contacts=5\nremove_existing=yes\n\n`;
  });
  safeWrite(FILES.users, usersConf);

  // 2. СИНХРОНИЗАЦИЯ ТРАНКОВ (Trunks)
  let trunksConf = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
  trunks.forEach(t => {
    trunksConf += `[trunk-${t.id}]\ntype=endpoint\ncontext=from-trunk\ndisallow=all\nallow=ulaw,alaw\noutbound_auth=auth-${t.id}\naors=aor-${t.id}\n\n`;
    
    trunksConf += `[auth-${t.id}]\ntype=auth\nauth_type=userpass\nusername=${t.user}\npassword=${t.password}\n\n`;
    
    trunksConf += `[aor-${t.id}]\ntype=aor\ncontact=sip:${t.host}:${t.port}\n\n`;
    
    trunksConf += `[reg-${t.id}]\ntype=registration\nendpoint=trunk-${t.id}\noutbound_auth=auth-${t.id}\nserver_uri=sip:${t.host}:${t.port}\nclient_uri=sip:${t.user}@${t.host}:${t.port}\n\n`;
    
    // Секция Identify обязательна для распознавания входящих по IP
    trunksConf += `[identify-${t.id}]\ntype=identify\nendpoint=trunk-${t.id}\nmatch=${t.host}\n\n`;
  });
  safeWrite(FILES.trunks, trunksConf);

  // 3. СИНХРОНИЗАЦИЯ ОЧЕРЕДЕЙ (Queues)
  let queuesConf = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
  queues.forEach(q => {
    queuesConf += `[${q.name}]\nstrategy=${q.strategy}\nmusicclass=${q.musicOnHoldClass || 'default'}\n`;
    (q.members || []).forEach(m => {
      queuesConf += `member => PJSIP/${m}\n`;
    });
    queuesConf += `\n`;
  });
  safeWrite(FILES.queues, queuesConf);

  // 4. СИНХРОНИЗАЦИЯ DIALPLAN (Маршруты + IVR)
  let dpConf = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';

  // Внутренние звонки
  dpConf += `[miac-internal]\n`;
  dpConf += `exten => _X.,1,NoOp(Внутренний вызов на $\{EXTEN\})\n`;
  dpConf += `same => n,Dial(PJSIP/$\{EXTEN\},30)\n`;
  dpConf += `same => n,Hangup()\n\n`;

  // IVR Контексты
  ivrs.forEach(ivr => {
    dpConf += `[miac-ivr-${ivr.id}]\n`;
    dpConf += `exten => s,1,Answer()\n`;
    dpConf += `same => n,Set(TIMEOUT(digit)=2)\n`;
    dpConf += `same => n,Background(${ivr.announcementFile})\n`;
    dpConf += `same => n,WaitExten(5)\n\n`;

    // Кнопки
    (ivr.digitMappings || []).forEach(m => {
      const [digit, type, target] = m.split(':');
      if (type === 'ext') {
        dpConf += `exten => ${digit},1,Dial(PJSIP/${target},30)\n`;
      } else if (type === 'queue') {
        dpConf += `exten => ${digit},1,Queue(${target})\n`;
      } else if (type === 'ivr') {
        dpConf += `exten => ${digit},1,Goto(miac-ivr-${target},s,1)\n`;
      }
      dpConf += `same => n,Hangup()\n`;
    });

    // Таймаут
    if (ivr.timeoutDestination && ivr.timeoutDestination !== 'hangup') {
      const [type, target] = ivr.timeoutDestination.split(':');
      if (type === 'Extension') {
        dpConf += `exten => t,1,Dial(PJSIP/${target},30)\n`;
      } else if (type === 'Queue') {
        dpConf += `exten => t,1,Queue(${target})\n`;
      }
    } else {
      dpConf += `exten => t,1,Hangup()\n`;
    }

    dpConf += `exten => i,1,Playback(invalid)\nsame => n,Goto(s,1)\n\n`;
  });

  // Входящие маршруты
  dpConf += `[from-trunk]\n`;
  routes.filter(r => r.type === 'inbound').forEach(r => {
    const [type, target] = r.destination.split(':');
    let action = '';
    if (type === 'Extension') action = `Dial(PJSIP/${target},30)`;
    else if (type === 'Queue') action = `Queue(${target})`;
    else if (type === 'IVR') action = `Goto(miac-ivr-${target},s,1)`;

    if (r.pattern === '*') {
      dpConf += `exten => s,1,${action}\n`;
      dpConf += `exten => _.,1,${action}\n`;
    } else {
      dpConf += `exten => ${r.pattern},1,${action}\n`;
    }
  });
  safeWrite(FILES.dialplan, dpConf);

  console.log('--- Синхронизация завершена успешно ---');
  console.log('Выполните "asterisk -rx \'core reload\'" для применения изменений.');
}

function safeWrite(file, content) {
  try {
    fs.writeFileSync(file, content);
    console.log(`Обновлен: ${file}`);
  } catch (e) {
    if (e.code === 'EACCES') {
      console.warn(`НЕТ ДОСТУПА к ${file}. Используйте chmod 666 /etc/asterisk/*.conf`);
    } else {
      console.error(`Ошибка записи ${file}:`, e.message);
    }
  }
}

sync();
