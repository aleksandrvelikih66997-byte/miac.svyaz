/**
 * МИАЦ.СВЯЗЬ - Asterisk Bridge
 * Генерация конфигурационных файлов Asterisk из JSON-базы данных.
 * Оптимизировано для Asterisk 17/20 + PJSIP.
 */

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'src/data');
const AST_DIR = '/etc/asterisk'; // В продакшене /etc/asterisk

// Пути к файлам базы
const DB_PATHS = {
  extensions: path.join(DATA_DIR, 'extensions.json'),
  trunks: path.join(DATA_DIR, 'trunks.json'),
  routes: path.join(DATA_DIR, 'routes.json'),
  queues: path.join(DATA_DIR, 'queues.json'),
  ivrs: path.join(DATA_DIR, 'ivrs.json'),
};

// Пути к конфигам Asterisk
const AST_FILES = {
  users: path.join(AST_DIR, 'pjsip_miac_users.conf'),
  trunks: path.join(AST_DIR, 'pjsip_miac_trunks.conf'),
  queues: path.join(AST_DIR, 'queues_miac.conf'),
  dialplan: path.join(AST_DIR, 'extensions_miac_dialplan.conf'),
};

function readDB(file) {
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return [];
  }
}

async function runBridge() {
  console.log('--- STARTING ASTERISK BRIDGE ---');
  
  const extensions = readDB(DB_PATHS.extensions);
  const trunks = readDB(DB_PATHS.trunks);
  const routes = readDB(DB_PATHS.routes);
  const queues = readDB(DB_PATHS.queues);
  const ivrs = readDB(DB_PATHS.ivrs);

  // 1. ГЕНЕРАЦИЯ ПОЛЬЗОВАТЕЛЕЙ (PJSIP)
  let usersConf = '; Сгенерировано МИАЦ.СВЯЗЬ - АБОНЕНТЫ\n\n';
  extensions.forEach(ext => {
    usersConf += `[${ext.id}]\ntype=endpoint\ncontext=miac-internal\ndisallow=all\nallow=ulaw,alaw\nauth=auth-${ext.id}\naors=${ext.id}\n`;
    usersConf += `identify_by=auth_username,username\n\n`; // Помогает Yealink и MicroSIP
    usersConf += `[auth-${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
    usersConf += `[${ext.id}]\ntype=aor\nmax_contacts=5\nremove_existing=yes\n\n`;
  });
  
  // 2. ГЕНЕРАЦИЯ ТРАНКОВ (PJSIP)
  let trunksConf = '; Сгенерировано МИАЦ.СВЯЗЬ - ТРАНКИ\n\n';
  trunks.forEach(trunk => {
    trunksConf += `[trunk-${trunk.id}]\ntype=endpoint\ncontext=from-trunk\ndisallow=all\nallow=ulaw,alaw\noutbound_auth=auth-${trunk.id}\naors=aor-${trunk.id}\n\n`;
    trunksConf += `[auth-${trunk.id}]\ntype=auth\nauth_type=userpass\nusername=${trunk.user}\npassword=${trunk.password}\n\n`;
    trunksConf += `[aor-${trunk.id}]\ntype=aor\ncontact=sip:${trunk.host}:${trunk.port}\n\n`;
    trunksConf += `[reg-${trunk.id}]\ntype=registration\nendpoint=trunk-${trunk.id}\noutbound_auth=auth-${trunk.id}\nserver_uri=sip:${trunk.host}:${trunk.port}\nclient_uri=sip:${trunk.user}@${trunk.host}:${trunk.port}\n\n`;
    trunksConf += `[identify-${trunk.id}]\ntype=identify\nendpoint=trunk-${trunk.id}\nmatch=${trunk.host}\n\n`; // Важно для входящих по IP
  });

  // 3. ГЕНЕРАЦИЯ ГРУПП (QUEUES)
  let queuesConf = '; Сгенерировано МИАЦ.СВЯЗЬ - ОЧЕРЕДИ\n\n';
  queues.forEach(q => {
    queuesConf += `[${q.name}]\nstrategy=${q.strategy}\nmusicclass=${q.musicOnHoldClass || 'default'}\ntimeout=20\nretry=5\n`;
    (q.members || []).forEach(m => {
      queuesConf += `member => PJSIP/${m}\n`;
    });
    queuesConf += `\n`;
  });

  // 4. ГЕНЕРАЦИЯ ДИАЛПЛАНА (EXTENSIONS)
  let dialplan = '; Сгенерировано МИАЦ.СВЯЗЬ - ДИАЛПЛАН\n\n';
  
  // Внутренние звонки (в отдельном контексте для безопасности)
  dialplan += `[miac-internal]\n`;
  dialplan += `exten => _XXX,1,Dial(PJSIP/\${EXTEN},30)\n`;
  dialplan += `exten => _XXX,n,Hangup()\n\n`;

  // Голосовые меню (IVR)
  ivrs.forEach(ivr => {
    dialplan += `[miac-ivr-${ivr.id}]\n`;
    dialplan += `exten => s,1,Answer()\n`;
    dialplan += `same => n,Set(TIMEOUT(digit)=2)\n`;
    dialplan += `same => n,Background(${ivr.announcementFile})\n`;
    dialplan += `same => n,WaitExten(5)\n`;
    
    // Обработка кнопок
    (ivr.digitMappings || []).forEach(mapping => {
      const [digit, type, targetId] = mapping.split(':');
      if (digit && type && targetId) {
        if (type === 'ext') dialplan += `exten => ${digit},1,Dial(PJSIP/${targetId},30)\n`;
        if (type === 'queue') dialplan += `exten => ${digit},1,Queue(${targetId})\n`;
        if (type === 'ivr') dialplan += `exten => ${digit},1,Goto(miac-ivr-${targetId},s,1)\n`;
      }
    });

    // Действие по таймауту (обязательно)
    if (ivr.timeoutDestination) {
      const [tType, tId] = ivr.timeoutDestination.split(':');
      if (tType === 'Extension') dialplan += `exten => t,1,Dial(PJSIP/${tId},30)\n`;
      else if (tType === 'Queue') dialplan += `exten => t,1,Queue(${tId})\n`;
      else dialplan += `exten => t,1,Hangup()\n`;
    } else {
      dialplan += `exten => t,1,Hangup()\n`;
    }
    
    dialplan += `exten => i,1,Playback(invalid)\n`;
    dialplan += `same => n,Goto(s,1)\n\n`;
  });

  // Входящая маршрутизация (из транков)
  dialplan += `[from-trunk]\n`;
  const inboundRoutes = routes.filter(r => r.type === 'inbound');
  inboundRoutes.forEach(route => {
    let target = 'Hangup()';
    if (route.destination.startsWith('IVR:')) target = `Goto(miac-ivr-${route.destination.split(':')[1]},s,1)`;
    else if (route.destination.startsWith('Extension:')) target = `Dial(PJSIP/${route.destination.split(':')[1]},30)`;
    else if (route.destination.startsWith('Queue:')) target = `Queue(${route.destination.split(':')[1]})`;

    if (route.pattern === '*') {
      dialplan += `exten => s,1,${target}\n`;
      dialplan += `exten => _.,1,${target}\n`;
    } else {
      dialplan += `exten => ${route.pattern},1,${target}\n`;
    }
  });

  // ЗАПИСЬ В ФАЙЛЫ
  try {
    fs.writeFileSync(AST_FILES.users, usersConf);
    fs.writeFileSync(AST_FILES.trunks, trunksConf);
    fs.writeFileSync(AST_FILES.queues, queuesConf);
    fs.writeFileSync(AST_FILES.dialplan, dialplan);
    console.log('--- CONFIGS GENERATED SUCCESSFULLY ---');
  } catch (err) {
    console.error('FAILED TO WRITE CONFIGS:', err.message);
  }
}

runBridge().catch(console.error);
