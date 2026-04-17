
import fs from 'fs';
import path from 'path';

/**
 * МИАЦ.СВЯЗЬ (Asterisk Bridge)
 * Синхронизирует JSON-базу с файлами Asterisk PJSIP и Dialplan.
 */

const DATA_DIR = path.join(process.cwd(), 'src/data');
const AST_DIR = '/etc/asterisk'; // В продакшене. Для теста можно сменить на 'src/data/asterisk'

const FILES = {
  extensions: path.join(DATA_DIR, 'extensions.json'),
  trunks: path.join(DATA_DIR, 'trunks.json'),
  routes: path.join(DATA_DIR, 'routes.json'),
  queues: path.join(DATA_DIR, 'queues.json'),
  ivrs: path.join(DATA_DIR, 'ivrs.json'),
};

const AST_CONF = {
  users: path.join(AST_DIR, 'pjsip_miac_users.conf'),
  trunks: path.join(AST_DIR, 'pjsip_miac_trunks.conf'),
  queues: path.join(AST_DIR, 'queues_miac.conf'),
  dialplan: path.join(AST_DIR, 'extensions_miac_dialplan.conf'),
};

function readJSON(file) {
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return [];
  }
}

function sync() {
  console.log('--- Начинаю синхронизацию с Asterisk ---');
  
  const extensions = readJSON(FILES.extensions);
  const trunks = readJSON(FILES.trunks);
  const queues = readJSON(FILES.queues);
  const ivrs = readJSON(FILES.ivrs);
  const routes = readJSON(FILES.routes);

  // 1. АБОНЕНТЫ (PJSIP Users)
  let usersContent = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
  extensions.forEach(ext => {
    usersContent += `[${ext.id}]\ntype=endpoint\ncontext=miac-internal\ndisallow=all\nallow=ulaw,alaw\nauth=auth-${ext.id}\naors=${ext.id}\ndirect_media=no\nidentify_by=auth_username,username\n\n`;
    usersContent += `[auth-${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
    usersContent += `[${ext.id}]\ntype=aor\nmax_contacts=1\n\n`;
  });
  if (fs.existsSync(AST_DIR)) fs.writeFileSync(AST_CONF.users, usersContent);

  // 2. ТРАНКИ (PJSIP Trunks)
  let trunksContent = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
  trunks.forEach(t => {
    trunksContent += `[trunk-${t.id}]\ntype=endpoint\ncontext=from-trunk\ndisallow=all\nallow=ulaw,alaw\noutbound_auth=auth-${t.id}\naors=aor-${t.id}\n\n`;
    trunksContent += `[auth-${t.id}]\ntype=auth\nauth_type=userpass\nusername=${t.user}\npassword=${t.password}\n\n`;
    trunksContent += `[aor-${t.id}]\ntype=aor\ncontact=sip:${t.host}:${t.port}\n\n`;
    trunksContent += `[reg-${t.id}]\ntype=registration\nendpoint=trunk-${t.id}\noutbound_auth=auth-${t.id}\nserver_uri=sip:${t.host}:${t.port}\nclient_uri=sip:${t.user}@${t.host}:${t.port}\n\n`;
    trunksContent += `[identify-${t.id}]\ntype=identify\nendpoint=trunk-${t.id}\nmatch=${t.host}\n\n`;
  });
  if (fs.existsSync(AST_DIR)) fs.writeFileSync(AST_CONF.trunks, trunksContent);

  // 3. ОЧЕРЕДИ
  let queuesContent = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
  queues.forEach(q => {
    queuesContent += `[${q.name}]\nstrategy=${q.strategy}\nmusicclass=${q.musicOnHoldClass || 'default'}\ntimeout=15\nretry=5\nwrapuptime=0\n`;
    (q.members || []).forEach(m => {
      queuesContent += `member => PJSIP/${m}\n`;
    });
    queuesContent += '\n';
  });
  if (fs.existsSync(AST_DIR)) fs.writeFileSync(AST_CONF.queues, queuesContent);

  // 4. DIALPLAN (Маршруты и IVR)
  let dialplanContent = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
  
  // Внутренняя связь (используем miac-internal чтобы не конфликтовать с from-internal в extensions.conf)
  dialplanContent += '[miac-internal]\n';
  dialplanContent += 'exten => _XXX,1,Dial(PJSIP/${EXTEN},30)\n';
  dialplanContent += 'same => n,Hangup()\n\n';

  // IVR Сценарии
  ivrs.forEach(ivr => {
    dialplanContent += `[miac-ivr-${ivr.id}]\n`;
    dialplanContent += `exten => s,1,Answer()\n`;
    dialplanContent += `same => n,Set(TIMEOUT(digit)=2)\n`;
    dialplanContent += `same => n,Background(${ivr.announcementFile})\n`;
    dialplanContent += `same => n,WaitExten(5)\n`;
    
    // Переходы по кнопкам
    (ivr.digitMappings || []).forEach(m => {
      const [digit, type, target] = m.split(':');
      if (type === 'ext') dialplanContent += `exten => ${digit},1,Dial(PJSIP/${target},30)\n`;
      else if (type === 'queue') dialplanContent += `exten => ${digit},1,Queue(${target})\n`;
      else if (type === 'ivr') dialplanContent += `exten => ${digit},1,Goto(miac-ivr-${target},s,1)\n`;
    });

    // Таймаут
    if (ivr.timeoutDestination) {
      const [type, target] = ivr.timeoutDestination.split(':');
      if (type === 'Extension') dialplanContent += `exten => t,1,Dial(PJSIP/${target},30)\n`;
      else if (type === 'Queue') dialplanContent += `exten => t,1,Queue(${target})\n`;
      else dialplanContent += `exten => t,1,Hangup()\n`;
    } else {
      dialplanContent += `exten => t,1,Hangup()\n`;
    }

    dialplanContent += `exten => i,1,Playback(invalid)\n`;
    dialplanContent += `same => n,Goto(s,1)\n\n`;
  });

  // Входящая маршрутизация (from-trunk)
  dialplanContent += '[from-trunk]\n';
  routes.filter(r => r.type === 'inbound').forEach(route => {
    const pattern = route.pattern === '*' ? 's' : route.pattern;
    const [type, target] = route.destination.split(':');
    
    let action = '';
    if (type === 'Extension') action = `Dial(PJSIP/${target},30)`;
    else if (type === 'Queue') action = `Queue(${target})`;
    else if (type === 'IVR') action = `Goto(miac-ivr-${target},s,1)`;
    
    dialplanContent += `exten => ${pattern},1,${action}\n`;
    if (pattern === 's') {
        dialplanContent += `exten => _,1,Goto(s,1)\n`; // По умолчанию всё на s
    }
  });
  
  // Если нет входящих маршрутов, создаем заглушку s
  if (!routes.some(r => r.type === 'inbound')) {
     dialplanContent += 'exten => s,1,Hangup()\n';
  }

  if (fs.existsSync(AST_DIR)) fs.writeFileSync(AST_CONF.dialplan, dialplanContent);

  console.log('Синхронизация завершена. Выполните: asterisk -rx "core reload"');
}

// Запуск
sync();
