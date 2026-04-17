
import fs from 'fs';
import path from 'path';

/**
 * МИАЦ.СВЯЗЬ - Скрипт синхронизации данных с Asterisk 17/20
 * Генерирует файлы конфигурации .conf на основе локальной базы данных JSON.
 */

const DATA_DIR = path.join(process.cwd(), 'src/data');
const ASTERISK_DIR = '/etc/asterisk'; // Путь для AltLinux SP 10

const FILES = {
  extensions: path.join(DATA_DIR, 'extensions.json'),
  trunks: path.join(DATA_DIR, 'trunks.json'),
  routes: path.join(DATA_DIR, 'routes.json'),
  queues: path.join(DATA_DIR, 'queues.json'),
  ivrs: path.join(DATA_DIR, 'ivrs.json'),
};

const CONF_FILES = {
  users: path.join(ASTERISK_DIR, 'pjsip_miac_users.conf'),
  trunks: path.join(ASTERISK_DIR, 'pjsip_miac_trunks.conf'),
  queues: path.join(ASTERISK_DIR, 'queues_miac.conf'),
  dialplan: path.join(ASTERISK_DIR, 'extensions_miac_dialplan.conf'),
};

function readJSON(file) {
  if (!fs.existsSync(file)) return [];
  try {
    const content = fs.readFileSync(file, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    return [];
  }
}

function sync() {
  console.log(`[${new Date().toLocaleTimeString()}] Синхронизация МИАЦ.АТС...`);

  // 1. Абоненты (PJSIP)
  const exts = readJSON(FILES.extensions);
  let usersConf = '; Сгенерировано МИАЦ.СВЯЗЬ - Абоненты\n\n';
  exts.forEach(e => {
    usersConf += `[${e.id}]\ntype=endpoint\ncontext=miac-internal\ndisallow=all\nallow=ulaw,alaw\nauth=auth-${e.id}\naors=${e.id}\n\n`;
    usersConf += `[auth-${e.id}]\ntype=auth\nauth_type=userpass\nusername=${e.id}\npassword=${e.secret}\n\n`;
    usersConf += `[${e.id}]\ntype=aor\nmax_contacts=1\n\n`;
  });

  // 2. Транки (PJSIP)
  const trunks = readJSON(FILES.trunks);
  let trunksConf = '; Сгенерировано МИАЦ.СВЯЗЬ - Внешние линии\n\n';
  trunks.forEach(t => {
    trunksConf += `[trunk-${t.id}]\ntype=endpoint\ncontext=from-trunk\ndisallow=all\nallow=ulaw,alaw\noutbound_auth=auth-${t.id}\naors=aor-${t.id}\n\n`;
    trunksConf += `[auth-${t.id}]\ntype=auth\nauth_type=userpass\nusername=${t.user}\npassword=${t.password}\n\n`;
    trunksConf += `[aor-${t.id}]\ntype=aor\ncontact=sip:${t.host}:${t.port || 5060}\n\n`;
    trunksConf += `[reg-${t.id}]\ntype=registration\noutbound_auth=auth-${t.id}\nserver_uri=sip:${t.host}:${t.port || 5060}\nclient_uri=sip:${t.user}@${t.host}:${t.port || 5060}\nretry_interval=60\nexpiration=120\n\n`;
    trunksConf += `[identify-${t.id}]\ntype=identify\nendpoint=trunk-${t.id}\nmatch=${t.host}\n\n`;
  });

  // 3. Очереди
  const queues = readJSON(FILES.queues);
  let queuesConf = '; Сгенерировано МИАЦ.СВЯЗЬ - Очереди\n\n';
  queues.forEach(q => {
    queuesConf += `[${q.name}]\nstrategy=${q.strategy}\nmusicclass=${q.musicOnHoldClass || 'default'}\n`;
    (q.members || []).forEach(m => {
      queuesConf += `member => PJSIP/${m}\n`;
    });
    queuesConf += `\n`;
  });

  // 4. Диалплан (Маршруты и IVR)
  const routes = readJSON(FILES.routes);
  const ivrs = readJSON(FILES.ivrs);
  let dialplanConf = '; Сгенерировано МИАЦ.СВЯЗЬ - Диалплан\n\n';

  // Внутренняя связь
  dialplanConf += `[miac-internal]\nexten => _XXX,1,Dial(PJSIP/\${EXTEN},30)\nexten => _XXX,n,Hangup()\n\n`;

  // IVR Сценарии
  ivrs.forEach(ivr => {
    dialplanConf += `[miac-ivr-${ivr.id}]\n`;
    dialplanConf += `exten => s,1,Answer()\nsame => n,Set(TIMEOUT(digit)=2)\nsame => n,Background(${ivr.announcementFile})\nsame => n,WaitExten(5)\n`;
    
    // Кнопки
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
    dialplanConf += `exten => i,1,Playback(invalid)\nexten => i,n,Goto(s,1)\n\n`;
  });

  // Входящие маршруты
  dialplanConf += `[from-trunk]\n`;
  routes.filter(r => r.type === 'inbound').forEach(r => {
    const [targetType, targetId] = r.destination.split(':');
    const pattern = r.pattern === '*' ? 's' : r.pattern;
    const priority = 1;
    
    let action = '';
    if (targetType === 'IVR') action = `Goto(miac-ivr-${targetId},s,1)`;
    else if (targetType === 'Extension') action = `Dial(PJSIP/${targetId},30)`;
    else if (targetType === 'Queue') action = `Queue(${targetId})`;

    dialplanConf += `exten => ${pattern},${priority},${action}\n`;
    if (pattern === 's') {
      dialplanConf += `exten => _.,1,Goto(s,1)\n`;
    }
  });

  // Исправляем пути для записи (проверка прав)
  try {
    fs.writeFileSync(CONF_FILES.users, usersConf);
    fs.writeFileSync(CONF_FILES.trunks, trunksConf);
    fs.writeFileSync(CONF_FILES.queues, queuesConf);
    fs.writeFileSync(CONF_FILES.dialplan, dialplanConf);
    console.log(`[SUCCESS] Файлы Asterisk обновлены.`);
  } catch (err) {
    console.error(`[ERROR] Ошибка записи в /etc/asterisk/: ${err.message}`);
    console.log(`Попробуйте выполнить: sudo chmod 666 /etc/asterisk/*.conf`);
  }
}

// Запуск
sync();
// Опционально: слежение за изменениями (в проде лучше вызывать явно через API)
// fs.watch(DATA_DIR, (event, filename) => sync());
