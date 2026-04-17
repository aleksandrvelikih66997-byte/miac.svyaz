
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'src/data');
const AST_DIR = '/etc/asterisk';

const FILES = {
  extensions: path.join(DATA_DIR, 'extensions.json'),
  trunks: path.join(DATA_DIR, 'trunks.json'),
  routes: path.join(DATA_DIR, 'routes.json'),
  queues: path.join(DATA_DIR, 'queues.json'),
  ivrs: path.join(DATA_DIR, 'ivrs.json'),
};

const CONF_FILES = {
  users: path.join(AST_DIR, 'pjsip_miac_users.conf'),
  trunks: path.join(AST_DIR, 'pjsip_miac_trunks.conf'),
  queues: path.join(AST_DIR, 'queues_miac.conf'),
  dialplan: path.join(AST_DIR, 'extensions_miac_dialplan.conf'),
};

function readJSON(file) {
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) { return []; }
}

function generateConfig() {
  const extensions = readJSON(FILES.extensions);
  const trunks = readJSON(FILES.trunks);
  const queues = readJSON(FILES.queues);
  const routes = readJSON(FILES.routes);
  const ivrs = readJSON(FILES.ivrs);

  console.log('[BRIDGE] Синхронизация данных с Asterisk...');

  // 1. Внутренние абоненты
  let usersConf = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
  extensions.forEach(ext => {
    usersConf += `[${ext.id}]\ntype=endpoint\ncontext=miac-internal\ndisallow=all\nallow=ulaw,alaw\nauth=auth-${ext.id}\naors=aor-${ext.id}\nidentify_by=auth_username,username\n\n`;
    usersConf += `[auth-${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
    usersConf += `[aor-${ext.id}]\ntype=aor\nmax_contacts=5\nremove_existing=yes\n\n`;
  });

  // 2. Транки
  let trunksConf = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
  trunks.forEach(t => {
    trunksConf += `[trunk-${t.id}]\ntype=endpoint\ncontext=from-trunk\ndisallow=all\nallow=ulaw,alaw\noutbound_auth=auth-${t.id}\naors=aor-${t.id}\n\n`;
    trunksConf += `[auth-${t.id}]\ntype=auth\nauth_type=userpass\nusername=${t.user}\npassword=${t.password}\n\n`;
    trunksConf += `[aor-${t.id}]\ntype=aor\ncontact=sip:${t.host}:${t.port}\n\n`;
    trunksConf += `[reg-${t.id}]\ntype=registration\nendpoint=trunk-${t.id}\noutbound_auth=auth-${t.id}\nserver_uri=sip:${t.host}:${t.port}\nclient_uri=sip:${t.user}@${t.host}:${t.port}\n\n`;
    trunksConf += `[identify-${t.id}]\ntype=identify\nendpoint=trunk-${t.id}\nmatch=${t.host}\n\n`;
  });

  // 3. Группы (Очереди)
  let queuesConf = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
  queues.forEach(q => {
    queuesConf += `[${q.name}]\nstrategy=${q.strategy}\nmusicclass=${q.musicOnHoldClass || 'default'}\ntimeout=15\nretry=5\nwrapuptime=0\n`;
    (q.members || []).forEach(m => {
      queuesConf += `member => PJSIP/${m}\n`;
    });
    queuesConf += `\n`;
  });

  // 4. Диалплан (IVR и Маршруты)
  let dialplanConf = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
  
  // Внутренние звонки
  dialplanConf += '[miac-internal]\n';
  extensions.forEach(ext => {
    dialplanConf += `exten => ${ext.id},1,Dial(PJSIP/${ext.id},30)\n`;
    dialplanConf += `same => n,Hangup()\n`;
  });
  dialplanConf += `exten => _X.,1,Goto(from-internal,\${EXTEN},1)\n\n`;

  // IVR Контексты
  ivrs.forEach(ivr => {
    dialplanConf += `[miac-ivr-${ivr.id}]\n`;
    dialplanConf += `exten => s,1,Answer()\n`;
    dialplanConf += `same => n,Wait(1)\n`;
    dialplanConf += `same => n,Background(${ivr.announcementFile})\n`;
    dialplanConf += `same => n,WaitExten(5)\n`;
    
    // Переход по таймауту
    if (ivr.timeoutDestination) {
      const [type, id] = ivr.timeoutDestination.split(':');
      if (type === 'Extension') dialplanConf += `exten => t,1,Dial(PJSIP/${id},30)\n`;
      else if (type === 'Queue') dialplanConf += `exten => t,1,Queue(${id})\n`;
      else dialplanConf += `exten => t,1,Hangup()\n`;
    } else {
      dialplanConf += `exten => t,1,Hangup()\n`;
    }

    // Кнопки
    (ivr.digitMappings || []).forEach(m => {
      const [digit, type, target] = m.split(':');
      if (type === 'ext') dialplanConf += `exten => ${digit},1,Dial(PJSIP/${target},30)\n`;
      else if (type === 'queue') dialplanConf += `exten => ${digit},1,Queue(${target})\n`;
      else if (type === 'ivr') dialplanConf += `exten => ${digit},1,Goto(miac-ivr-${target},s,1)\n`;
    });
    dialplanConf += `\n`;
  });

  // Входящие маршруты
  dialplanConf += '[from-trunk]\n';
  routes.filter(r => r.type === 'inbound').forEach(r => {
    const [destType, destId] = r.destination.split(':');
    let target = 'Hangup()';
    if (destType === 'Extension') target = `Dial(PJSIP/${destId},30)`;
    else if (destType === 'Queue') target = `Queue(${destId})`;
    else if (destType === 'IVR') target = `Goto(miac-ivr-${destId},s,1)`;

    if (r.pattern === '*' || r.pattern === 's') {
      dialplanConf += `exten => s,1,${target}\n`;
      dialplanConf += `exten => _.,1,${target}\n`;
    } else {
      dialplanConf += `exten => ${r.pattern},1,${target}\n`;
    }
  });

  // Запись файлов
  try {
    fs.writeFileSync(CONF_FILES.users, usersConf);
    fs.writeFileSync(CONF_FILES.trunks, trunksConf);
    fs.writeFileSync(CONF_FILES.queues, queuesConf);
    fs.writeFileSync(CONF_FILES.dialplan, dialplanConf);
    console.log('[BRIDGE] Конфигурация успешно обновлена.');
  } catch (e) {
    console.error('[BRIDGE] ОШИБКА записи в /etc/asterisk/:', e.message);
  }
}

// Запуск
generateConfig();
setInterval(generateConfig, 5000);
