
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const DATA_DIR = path.join(process.cwd(), 'src/data');
const AST_DIR = '/etc/asterisk';

const FILES = {
  extensions: path.join(DATA_DIR, 'extensions.json'),
  trunks: path.join(DATA_DIR, 'trunks.json'),
  routes: path.join(DATA_DIR, 'routes.json'),
  queues: path.join(DATA_DIR, 'queues.json'),
  ivrs: path.join(DATA_DIR, 'ivrs.json'),
};

const AST_FILES = {
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
  console.log(`[${new Date().toLocaleTimeString()}] Синхронизация с Asterisk...`);

  const extensions = readJSON(FILES.extensions);
  const trunks = readJSON(FILES.trunks);
  const routes = readJSON(FILES.routes);
  const queues = readJSON(FILES.queues);
  const ivrs = readJSON(FILES.ivrs);

  // 1. PJSIP Абоненты
  let usersConf = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
  extensions.forEach(ext => {
    usersConf += `[${ext.id}]\ntype=endpoint\ncontext=miac-internal\ndisallow=all\nallow=ulaw,alaw\nauth=auth-${ext.id}\naors=${ext.id}\nidentify_by=auth_username,username\n\n`;
    usersConf += `[auth-${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
    usersConf += `[${ext.id}]\ntype=aor\nmax_contacts=5\nremove_existing=yes\n\n`;
  });
  fs.writeFileSync(AST_FILES.users, usersConf);

  // 2. PJSIP Транки
  let trunksConf = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
  trunks.forEach(t => {
    trunksConf += `[trunk-${t.id}]\ntype=endpoint\ncontext=from-trunk\ndisallow=all\nallow=ulaw,alaw\noutbound_auth=auth-${t.id}\naors=aor-${t.id}\n\n`;
    trunksConf += `[auth-${t.id}]\ntype=auth\nauth_type=userpass\nusername=${t.user}\npassword=${t.password}\n\n`;
    trunksConf += `[aor-${t.id}]\ntype=aor\ncontact=sip:${t.host}:${t.port}\n\n`;
    trunksConf += `[reg-${t.id}]\ntype=registration\nendpoint=trunk-${t.id}\noutbound_auth=auth-${t.id}\nserver_uri=sip:${t.host}:${t.port}\nclient_uri=sip:${t.user}@${t.host}:${t.port}\n\n`;
    if (t.host) {
      trunksConf += `[identify-${t.id}]\ntype=identify\nendpoint=trunk-${t.id}\nmatch=${t.host}\n\n`;
    }
  });
  fs.writeFileSync(AST_FILES.trunks, trunksConf);

  // 3. Очереди
  let queuesConf = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
  queues.forEach(q => {
    queuesConf += `[${q.name}]\nstrategy=${q.strategy || 'ringall'}\nmusicclass=${q.musicOnHoldClass || 'default'}\n`;
    (q.members || []).forEach(m => {
      queuesConf += `member => PJSIP/${m}\n`;
    });
    queuesConf += '\n';
  });
  fs.writeFileSync(AST_FILES.queues, queuesConf);

  // 4. Диалплан (Маршрутизация и IVR)
  let dialplan = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
  
  // Внутренняя связь
  dialplan += '[miac-internal]\n';
  dialplan += 'exten => _XXX,1,Dial(PJSIP/${EXTEN},30)\n';
  dialplan += 'same => n,Hangup()\n\n';

  // Входящая маршрутизация (from-trunk)
  dialplan += '[from-trunk]\n';
  routes.filter(r => r.type === 'inbound').forEach(r => {
    const target = r.destination.split(':');
    if (target[0] === 'IVR') {
      dialplan += `exten => ${r.pattern},1,Goto(miac-ivr-${target[1]},s,1)\n`;
      if (r.pattern === '*') dialplan += `exten => s,1,Goto(miac-ivr-${target[1]},s,1)\n`;
    } else if (target[0] === 'Extension') {
      dialplan += `exten => ${r.pattern},1,Dial(PJSIP/${target[1]},30)\n`;
    } else if (target[0] === 'Queue') {
      dialplan += `exten => ${r.pattern},1,Queue(${target[1]})\n`;
    }
  });
  // Если нет явных маршрутов, кидаем на s
  dialplan += 'exten => s,1,NoOp(Входящий вызов без DID)\n';
  dialplan += 'same => n,Answer()\n';
  dialplan += 'same => n,Wait(1)\n';
  dialplan += 'same => n,Hangup()\n\n';

  // IVR меню
  ivrs.forEach(ivr => {
    dialplan += `[miac-ivr-${ivr.id}]\n`;
    dialplan += 'exten => s,1,Answer()\n';
    dialplan += 'same => n,Wait(1)\n';
    dialplan += `same => n,Background(${ivr.announcementFile})\n`;
    dialplan += 'same => n,WaitExten(5)\n';
    
    // Таймаут
    if (ivr.timeoutDestination) {
      const parts = ivr.timeoutDestination.split(':');
      if (parts[0] === 'Extension') dialplan += `exten => t,1,Dial(PJSIP/${parts[1]},30)\n`;
      else if (parts[0] === 'Queue') dialplan += `exten => t,1,Queue(${parts[1]})\n`;
      else dialplan += 'exten => t,1,Hangup()\n';
    } else {
      dialplan += 'exten => t,1,Hangup()\n';
    }

    // Кнопки
    (ivr.digitMappings || []).forEach(m => {
      const [digit, type, target] = m.split(':');
      if (type === 'ext') dialplan += `exten => ${digit},1,Dial(PJSIP/${target},30)\n`;
      else if (type === 'queue') dialplan += `exten => ${digit},1,Queue(${target})\n`;
      else if (type === 'ivr') dialplan += `exten => ${digit},1,Goto(miac-ivr-${target},s,1)\n`;
    });
    dialplan += 'exten => i,1,Playback(invalid)\n';
    dialplan += 'same => n,Goto(s,1)\n\n';
  });

  fs.writeFileSync(AST_FILES.dialplan, dialplan);

  try {
    execSync('asterisk -rx "core reload"');
    console.log('Asterisk конфигурация обновлена.');
  } catch (e) {
    console.error('Ошибка перезагрузки Asterisk:', e.message);
  }
}

// Запуск при старте и отслеживание изменений
sync();
fs.watch(DATA_DIR, (event, filename) => {
  if (filename && filename.endsWith('.json')) {
    sync();
  }
});
