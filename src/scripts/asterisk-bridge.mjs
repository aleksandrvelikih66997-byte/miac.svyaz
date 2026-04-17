
import fs from 'fs';
import path from 'path';

// Пути к файлам Asterisk
const CONF_PATHS = {
  users: '/etc/asterisk/pjsip_miac_users.conf',
  trunks: '/etc/asterisk/pjsip_miac_trunks.conf',
  queues: '/etc/asterisk/queues_miac.conf',
  dialplan: '/etc/asterisk/extensions_miac_dialplan.conf',
};

// Пути к нашим данным
const DATA_DIR = path.join(process.cwd(), 'src/data');
const DATA_FILES = {
  extensions: path.join(DATA_DIR, 'extensions.json'),
  trunks: path.join(DATA_DIR, 'trunks.json'),
  routes: path.join(DATA_DIR, 'routes.json'),
  queues: path.join(DATA_DIR, 'queues.json'),
  ivrs: path.join(DATA_DIR, 'ivrs.json'),
};

function readData(file) {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

async function sync() {
  console.log('[BRIDGE] Синхронизация данных...');

  const extensions = readData(DATA_FILES.extensions);
  const trunks = readData(DATA_FILES.trunks);
  const routes = readData(DATA_FILES.routes);
  const queues = readData(DATA_FILES.queues);
  const ivrs = readData(DATA_FILES.ivrs);

  // 1. Генерируем абонентов
  let usersConf = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
  extensions.forEach(ext => {
    usersConf += `[${ext.id}]\ntype=endpoint\ncontext=miac-internal\ndisallow=all\nallow=ulaw,alaw\nauth=auth-${ext.id}\naors=aor-${ext.id}\nidentify_by=auth_username,username\n\n`;
    usersConf += `[auth-${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
    usersConf += `[aor-${ext.id}]\ntype=aor\nmax_contacts=5\nremove_existing=yes\n\n`;
  });

  // 2. Генерируем транки
  let trunksConf = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
  trunks.forEach(t => {
    trunksConf += `[trunk-${t.user}]\ntype=endpoint\ncontext=from-trunk\ndisallow=all\nallow=ulaw,alaw\noutbound_auth=auth-${t.user}\naors=aor-${t.user}\n\n`;
    trunksConf += `[auth-${t.user}]\ntype=auth\nauth_type=userpass\nusername=${t.user}\npassword=${t.password}\n\n`;
    trunksConf += `[aor-${t.user}]\ntype=aor\ncontact=sip:${t.host}:${t.port}\n\n`;
    trunksConf += `[reg-${t.user}]\ntype=registration\nendpoint=trunk-${t.user}\noutbound_auth=auth-${t.user}\nserver_uri=sip:${t.host}:${t.port}\nclient_uri=sip:${t.user}@${t.host}:${t.port}\n\n`;
    // Identify block for incoming calls by IP
    trunksConf += `[identify-${t.user}]\ntype=identify\nendpoint=trunk-${t.user}\nmatch=${t.host}\n\n`;
  });

  // 3. Генерируем очереди
  let queuesConf = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
  queues.forEach(q => {
    queuesConf += `[${q.name}]\nstrategy=${q.strategy}\nmusicclass=${q.musicOnHoldClass || 'default'}\ntimeout=15\nretry=5\nwrapuptime=0\n`;
    (q.members || []).forEach(m => {
      queuesConf += `member => PJSIP/${m}\n`;
    });
    queuesConf += '\n';
  });

  // 4. Генерируем Dialplan
  let dialplanConf = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
  
  // Внутренняя связь
  dialplanConf += '[miac-internal]\n';
  extensions.forEach(ext => {
    dialplanConf += `exten => ${ext.id},1,Dial(PJSIP/${ext.id},30)\n`;
    dialplanConf += `same => n,Hangup()\n`;
  });
  
  // IVR меню
  ivrs.forEach(ivr => {
    dialplanConf += `\n[miac-ivr-${ivr.id}]\n`;
    dialplanConf += `exten => s,1,Answer()\n`;
    dialplanConf += `same => n,Background(${ivr.announcementFile})\n`;
    dialplanConf += `same => n,WaitExten(5)\n`;
    
    // Кнопки IVR
    (ivr.digitMappings || []).forEach(m => {
      const [digit, type, target] = m.split(':');
      if (type === 'ext') dialplanConf += `exten => ${digit},1,Dial(PJSIP/${target},30)\n`;
      if (type === 'queue') dialplanConf += `exten => ${digit},1,Queue(${target})\n`;
      if (type === 'ivr') dialplanConf += `exten => ${digit},1,Goto(miac-ivr-${target},s,1)\n`;
    });

    // Таймаут
    if (ivr.timeoutDestination) {
      const [tType, tId] = ivr.timeoutDestination.split(':');
      if (tType === 'Extension') dialplanConf += `exten => t,1,Dial(PJSIP/${tId},30)\n`;
      else if (tType === 'Queue') dialplanConf += `exten => t,1,Queue(${tId})\n`;
      else dialplanConf += `exten => t,1,Hangup()\n`;
    } else {
      dialplanConf += `exten => t,1,Hangup()\n`;
    }
    dialplanConf += `exten => i,1,Playback(invalid)\n`;
    dialplanConf += `same => n,Goto(s,1)\n`;
  });

  // Входящая маршрутизация
  dialplanConf += '\n[from-trunk]\n';
  routes.filter(r => r.type === 'inbound').forEach(r => {
    const [dType, dId] = r.destination.split(':');
    let target = '';
    if (dType === 'Extension') target = `PJSIP/${dId},30`;
    if (dType === 'Queue') target = `Queue(${dId})`;
    if (dType === 'IVR') {
      dialplanConf += `exten => ${r.pattern === '*' ? 's' : r.pattern},1,Goto(miac-ivr-${dId},s,1)\n`;
      if (r.pattern === '*') dialplanConf += `exten => _.,1,Goto(miac-ivr-${dId},s,1)\n`;
    } else {
      dialplanConf += `exten => ${r.pattern === '*' ? 's' : r.pattern},1,Dial(${target})\n`;
      if (r.pattern === '*') dialplanConf += `exten => _.,1,Dial(${target})\n`;
    }
  });

  // Запись файлов (с флагом 'w' для полной перезаписи)
  try {
    fs.writeFileSync(CONF_PATHS.users, usersConf, { flag: 'w' });
    fs.writeFileSync(CONF_PATHS.trunks, trunksConf, { flag: 'w' });
    fs.writeFileSync(CONF_PATHS.queues, queuesConf, { flag: 'w' });
    fs.writeFileSync(CONF_PATHS.dialplan, dialplanConf, { flag: 'w' });
    console.log('[BRIDGE] Успешно синхронизировано.');
  } catch (err) {
    console.error('[BRIDGE] ОШИБКА записи файлов:', err.message);
  }
}

// Запуск
sync();
// Опционально: слежение за изменениями файлов .json
// fs.watch(DATA_DIR, (event, filename) => { if (filename.endsWith('.json')) sync(); });
