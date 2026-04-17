
import fs from 'fs';
import path from 'path';

/**
 * Скрипт "Моста" для МИАЦ.СВЯЗЬ.
 * Генерирует конфигурацию Asterisk на основе JSON данных приложения.
 */

const DATA_DIR = path.join(process.cwd(), 'src/data');
const AST_CONF_DIR = '/etc/asterisk';

const FILES = {
  users: path.join(DATA_DIR, 'extensions.json'),
  trunks: path.join(DATA_DIR, 'trunks.json'),
  routes: path.join(DATA_DIR, 'routes.json'),
  queues: path.join(DATA_DIR, 'queues.json'),
  ivrs: path.join(DATA_DIR, 'ivrs.json'),
};

const TARGET_FILES = {
  pjsip_users: path.join(AST_CONF_DIR, 'pjsip_miac_users.conf'),
  pjsip_trunks: path.join(AST_CONF_DIR, 'pjsip_miac_trunks.conf'),
  dialplan: path.join(AST_CONF_DIR, 'extensions_miac_dialplan.conf'),
  queues: path.join(AST_CONF_DIR, 'queues_miac.conf'),
};

function readData(file) {
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return [];
  }
}

async function sync() {
  console.log('[BRIDGE] Синхронизация с Asterisk...');

  const users = readData(FILES.users);
  const trunks = readData(FILES.trunks);
  const routes = readData(FILES.routes);
  const queues = readData(FILES.queues);
  const ivrs = readData(FILES.ivrs);

  // 1. ГЕНЕРАЦИЯ АБОНЕНТОВ (PJSIP)
  let pjsipUsersContent = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
  users.forEach(u => {
    pjsipUsersContent += `[${u.id}]\ntype=endpoint\ncontext=miac-internal\ndisallow=all\nallow=ulaw,alaw\nauth=auth-${u.id}\naors=aor-${u.id}\ndirect_media=no\nidentify_by=auth_username,username\n\n`;
    pjsipUsersContent += `[auth-${u.id}]\ntype=auth\nauth_type=userpass\nusername=${u.id}\npassword=${u.secret}\n\n`;
    pjsipUsersContent += `[aor-${u.id}]\ntype=aor\nmax_contacts=5\nremove_existing=yes\n\n`;
  });

  // 2. ГЕНЕРАЦИЯ ТРАНКОВ (PJSIP + IDENTIFY)
  let pjsipTrunksContent = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
  trunks.forEach(t => {
    pjsipTrunksContent += `[trunk-${t.id}]\ntype=endpoint\ncontext=from-trunk\ndisallow=all\nallow=ulaw,alaw\noutbound_auth=auth-${t.id}\naors=aor-${t.id}\n\n`;
    pjsipTrunksContent += `[auth-${t.id}]\ntype=auth\nauth_type=userpass\nusername=${t.user}\npassword=${t.password}\n\n`;
    pjsipTrunksContent += `[aor-${t.id}]\ntype=aor\ncontact=sip:${t.host}:${t.port}\n\n`;
    pjsipTrunksContent += `[reg-${t.id}]\ntype=registration\nendpoint=trunk-${t.id}\noutbound_auth=auth-${t.id}\nserver_uri=sip:${t.host}:${t.port}\nclient_uri=sip:${t.user}@${t.host}:${t.port}\n\n`;
    // Identify для входящих по IP
    pjsipTrunksContent += `[identify-${t.id}]\ntype=identify\nendpoint=trunk-${t.id}\nmatch=${t.host}\n\n`;
  });

  // 3. ГЕНЕРАЦИЯ ОЧЕРЕДЕЙ (QUEUES)
  let queuesContent = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
  queues.forEach(q => {
    queuesContent += `[${q.name}]\nstrategy=${q.strategy}\nmusicclass=${q.musicOnHoldClass || 'default'}\ntimeout=15\nretry=5\nwrapuptime=0\n`;
    (q.members || []).forEach(m => {
      queuesContent += `member => PJSIP/${m}\n`;
    });
    queuesContent += '\n';
  });

  // 4. ГЕНЕРАЦИЯ ДИАЛПЛАНА (EXTENSIONS)
  let dialplanContent = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n[miac-internal]\n';
  users.forEach(u => {
    dialplanContent += `exten => ${u.id},1,Dial(PJSIP/${u.id},30)\n`;
    dialplanContent += `same => n,Hangup()\n`;
  });

  // Добавляем IVR контексты
  ivrs.forEach(ivr => {
    dialplanContent += `\n[miac-ivr-${ivr.id}]\n`;
    dialplanContent += `exten => s,1,Answer()\n`;
    dialplanContent += `same => n,Set(TIMEOUT(digit)=2)\n`;
    dialplanContent += `same => n,Background(${ivr.announcementFile})\n`;
    dialplanContent += `same => n,WaitExten(5)\n`;
    
    // Обработка таймаута
    if (ivr.timeoutDestination && ivr.timeoutDestination !== 'hangup') {
      const [type, target] = ivr.timeoutDestination.split(':');
      if (type === 'Extension') dialplanContent += `exten => t,1,Dial(PJSIP/${target},30)\n`;
      else if (type === 'Queue') dialplanContent += `exten => t,1,Queue(${target})\n`;
    } else {
      dialplanContent += `exten => t,1,Hangup()\n`;
    }

    // Обработка кнопок
    (ivr.digitMappings || []).forEach(m => {
      const [digit, type, target] = m.split(':');
      if (type === 'ext') dialplanContent += `exten => ${digit},1,Dial(PJSIP/${target},30)\n`;
      else if (type === 'queue') dialplanContent += `exten => ${digit},1,Queue(${target})\n`;
      else if (type === 'ivr') dialplanContent += `exten => ${digit},1,Goto(miac-ivr-${target},s,1)\n`;
    });
    
    dialplanContent += `exten => i,1,Playback(invalid)\nsame => n,Goto(s,1)\n`;
  });

  // Входящие маршруты
  dialplanContent += `\n[from-trunk]\n`;
  routes.forEach(r => {
    if (r.type === 'inbound') {
      const pattern = r.pattern === '*' ? 's' : r.pattern;
      const [type, target] = r.destination.split(':');
      if (type === 'IVR') dialplanContent += `exten => ${pattern},1,Goto(miac-ivr-${target},s,1)\n`;
      else if (type === 'Extension') dialplanContent += `exten => ${pattern},1,Dial(PJSIP/${target},30)\n`;
      else if (type === 'Queue') dialplanContent += `exten => ${pattern},1,Queue(${target})\n`;
    }
  });
  // Обработка 's' по умолчанию если нет DID
  dialplanContent += `exten => s,1,NoOp(No explicit route for s, hanging up)\nsame => n,Hangup()\n`;

  // ЗАПИСЬ В ФАЙЛЫ
  try {
    if (fs.existsSync(AST_CONF_DIR)) {
      fs.writeFileSync(TARGET_FILES.pjsip_users, pjsipUsersContent);
      fs.writeFileSync(TARGET_FILES.pjsip_trunks, pjsipTrunksContent);
      fs.writeFileSync(TARGET_FILES.dialplan, dialplanContent);
      fs.writeFileSync(TARGET_FILES.queues, queuesContent);
      console.log('[BRIDGE] Конфигурация успешно обновлена в ' + AST_CONF_DIR);
    } else {
      console.warn('[BRIDGE] Папка /etc/asterisk не найдена. Проверьте окружение.');
    }
  } catch (err) {
    console.error('[BRIDGE] Ошибка записи в файлы Asterisk:', err.message);
  }
}

sync();
