
import fs from 'fs';
import path from 'path';

// Пути к файлам данных
const DATA_DIR = path.join(process.cwd(), 'src/data');
const SOUNDS_DIR = path.join(DATA_DIR, 'sounds');
const ASTERISK_CONF_DIR = '/etc/asterisk'; // Путь в AltLinux

// Пути к генерируемым файлам
const FILES = {
  users: path.join(ASTERISK_CONF_DIR, 'pjsip_miac_users.conf'),
  trunks: path.join(ASTERISK_CONF_DIR, 'pjsip_miac_trunks.conf'),
  queues: path.join(ASTERISK_CONF_DIR, 'queues_miac.conf'),
  dialplan: path.join(ASTERISK_CONF_DIR, 'extensions_miac_dialplan.conf'),
};

function readJSON(filename) {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return [];
  }
}

async function sync() {
  console.log(`[${new Date().toLocaleTimeString()}] Синхронизация с Asterisk...`);

  const extensions = readJSON('extensions.json');
  const trunks = readJSON('trunks.json');
  const routes = readJSON('routes.json');
  const queues = readJSON('queues.json');
  const ivrs = readJSON('ivrs.json');

  // 1. Генерация Абонентов (PJSIP Users)
  let usersConf = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
  extensions.forEach(ext => {
    usersConf += `[${ext.id}]\ntype=endpoint\ncontext=from-internal\ndisallow=all\nallow=ulaw,alaw\nauth=auth-${ext.id}\naors=${ext.id}\n`;
    usersConf += `identify_by=auth_username,username\n\n`;
    usersConf += `[auth-${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
    usersConf += `[${ext.id}]\ntype=aor\nmax_contacts=5\nremove_existing=yes\n\n`;
  });

  // 2. Генерация Транков (PJSIP Trunks)
  let trunksConf = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
  trunks.forEach(t => {
    trunksConf += `[trunk-${t.id}]\ntype=endpoint\ncontext=from-trunk\ndisallow=all\nallow=ulaw,alaw\noutbound_auth=auth-${t.id}\naors=aor-${t.id}\n\n`;
    trunksConf += `[auth-${t.id}]\ntype=auth\nauth_type=userpass\nusername=${t.user}\npassword=${t.password}\n\n`;
    trunksConf += `[aor-${t.id}]\ntype=aor\ncontact=sip:${t.host}:${t.port}\n\n`;
    trunksConf += `[reg-${t.id}]\ntype=registration\nendpoint=trunk-${t.id}\noutbound_auth=auth-${t.id}\nserver_uri=sip:${t.host}:${t.port}\nclient_uri=sip:${t.user}@${t.host}:${t.port}\n\n`;
    trunksConf += `[identify-${t.id}]\ntype=identify\nendpoint=trunk-${t.id}\nmatch=${t.host}\n\n`;
  });

  // 3. Генерация Очередей
  let queuesConf = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
  queues.forEach(q => {
    queuesConf += `[${q.name}]\nstrategy=${q.strategy}\nmusicclass=${q.musicOnHoldClass || 'default'}\n`;
    (q.members || []).forEach(m => {
      queuesConf += `member => PJSIP/${m}\n`;
    });
    queuesConf += `\n`;
  });

  // 4. Генерация Диалплана (Маршруты и IVR)
  let dialplanConf = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
  
  // Внутренняя связь (используем другое имя контекста, чтобы не было конфликта с extensions.conf)
  dialplanConf += `[miac-internal]\nexten => _XXX,1,Dial(PJSIP/\${EXTEN},30)\nexten => _XXX,n,Hangup()\n\n`;

  // IVR Сценарии
  ivrs.forEach(ivr => {
    dialplanConf += `[miac-ivr-${ivr.id}]\n`;
    dialplanConf += `exten => s,1,Answer()\n`;
    dialplanConf += `same => n,Wait(1)\n`;
    dialplanConf += `same => n,Background(${ivr.announcementFile})\n`;
    dialplanConf += `same => n,WaitExten(5)\n`;

    // Обработка кнопок
    (ivr.digitMappings || []).forEach(m => {
      const [digit, type, target] = m.split(':');
      if (type === 'ext') dialplanConf += `exten => ${digit},1,Dial(PJSIP/${target},30)\n`;
      if (type === 'queue') dialplanConf += `exten => ${digit},1,Queue(${target})\n`;
      if (type === 'ivr') dialplanConf += `exten => ${digit},1,Goto(miac-ivr-${target},s,1)\n`;
    });

    // Таймаут
    if (ivr.timeoutDestination) {
      const [tType, tTarget] = ivr.timeoutDestination.split(':');
      if (tType === 'Extension') dialplanConf += `exten => t,1,Dial(PJSIP/${tTarget},30)\n`;
      else if (tType === 'Queue') dialplanConf += `exten => t,1,Queue(${tTarget})\n`;
      else dialplanConf += `exten => t,1,Hangup()\n`;
    } else {
      dialplanConf += `exten => t,1,Hangup()\n`;
    }

    dialplanConf += `exten => i,1,Playback(invalid)\n`;
    dialplanConf += `same => n,Goto(s,1)\n\n`;
  });

  // Входящая маршрутизация
  dialplanConf += `[from-trunk]\n`;
  routes.filter(r => r.type === 'inbound').forEach(route => {
    const pattern = route.pattern === '*' ? '_.' : route.pattern;
    const [dType, dId] = route.destination.split(':');
    
    let action = '';
    if (dType === 'Extension') action = `Dial(PJSIP/${dId},30)`;
    else if (dType === 'Queue') action = `Queue(${dId})`;
    else if (dType === 'IVR') action = `Goto(miac-ivr-${dId},s,1)`;

    dialplanConf += `exten => ${pattern},1,NoOp(Inbound call to ${pattern})\n`;
    dialplanConf += `same => n,${action}\n`;
    
    // Поддержка 's' если DID не пришел
    if (pattern === '_.') {
      dialplanConf += `exten => s,1,${action}\n`;
    }
  });

  // Запись файлов (если есть права доступа)
  try {
    fs.writeFileSync(FILES.users, usersConf);
    fs.writeFileSync(FILES.trunks, trunksConf);
    fs.writeFileSync(FILES.queues, queuesConf);
    fs.writeFileSync(FILES.dialplan, dialplanConf);
    console.log('[OK] Конфигурации обновлены. Выполните "asterisk -rx reload"');
  } catch (err) {
    console.error('[ERROR] Ошибка записи конфигов:', err.message);
  }
}

// Запуск цикла
sync();
setInterval(sync, 15000);
