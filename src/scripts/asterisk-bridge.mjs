
import fs from 'fs';
import path from 'path';

/**
 * Скрипт-мост для синхронизации данных из JSON в конфигурационные файлы Asterisk.
 * Генерирует pjsip_miac_trunks.conf, pjsip_miac_users.conf и extensions_miac_dialplan.conf.
 */

const DATA_DIR = path.join(process.cwd(), 'src/data');
const AST_CONF_DIR = '/etc/asterisk';

const FILES = {
  extensions: path.join(DATA_DIR, 'extensions.json'),
  trunks: path.join(DATA_DIR, 'trunks.json'),
  routes: path.join(DATA_DIR, 'routes.json'),
  queues: path.join(DATA_DIR, 'queues.json'),
  ivrs: path.join(DATA_DIR, 'ivrs.json'),
};

const TARGET_CONFS = {
  users: path.join(AST_CONF_DIR, 'pjsip_miac_users.conf'),
  trunks: path.join(AST_CONF_DIR, 'pjsip_miac_trunks.conf'),
  dialplan: path.join(AST_CONF_DIR, 'extensions_miac_dialplan.conf'),
  queues: path.join(AST_CONF_DIR, 'queues_miac.conf'),
};

function readJSON(file) {
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return [];
  }
}

function generateConfig() {
  console.log('--- Начинаю генерацию конфигов Asterisk ---');

  const extensions = readJSON(FILES.extensions);
  const trunks = readJSON(FILES.trunks);
  const routes = readJSON(FILES.routes);
  const queues = readJSON(FILES.queues);
  const ivrs = readJSON(FILES.ivrs);

  // 1. ГЕНЕРАЦИЯ АБОНЕНТОВ (PJSIP USERS)
  let usersConf = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
  extensions.forEach(ext => {
    usersConf += `[${ext.id}]\ntype=endpoint\ncontext=miac-internal\ndisallow=all\nallow=ulaw,alaw\nauth=auth-${ext.id}\naors=${ext.id}\nidentify_by=auth_username,username\n\n`;
    usersConf += `[auth-${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
    usersConf += `[${ext.id}]\ntype=aor\nmax_contacts=5\nremove_existing=yes\n\n`;
  });

  // 2. ГЕНЕРАЦИЯ ТРАНКОВ (PJSIP TRUNKS)
  let trunksConf = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
  trunks.forEach(trunk => {
    trunksConf += `[trunk-${trunk.id}]\ntype=endpoint\ncontext=from-trunk\ndisallow=all\nallow=ulaw,alaw\noutbound_auth=auth-${trunk.id}\naors=aor-${trunk.id}\n\n`;
    trunksConf += `[auth-${trunk.id}]\ntype=auth\nauth_type=userpass\nusername=${trunk.user}\npassword=${trunk.password}\n\n`;
    trunksConf += `[aor-${trunk.id}]\ntype=aor\ncontact=sip:${trunk.host}:${trunk.port}\n\n`;
    trunksConf += `[reg-${trunk.id}]\ntype=registration\nendpoint=trunk-${trunk.id}\noutbound_auth=auth-${trunk.id}\nserver_uri=sip:${trunk.host}:${trunk.port}\nclient_uri=sip:${trunk.user}@${trunk.host}:${trunk.port}\n\n`;
    trunksConf += `[identify-${trunk.id}]\ntype=identify\nendpoint=trunk-${trunk.id}\nmatch=${trunk.host}\n\n`;
  });

  // 3. ГЕНЕРАЦИЯ ДИАЛПЛАНА (EXTENSIONS)
  let dialplanConf = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
  
  // Внутренняя связь
  dialplanConf += '[miac-internal]\n';
  extensions.forEach(ext => {
    dialplanConf += `exten => ${ext.id},1,Dial(PJSIP/${ext.id},30)\n`;
    dialplanConf += `same => n,Hangup()\n`;
  });
  // Шаблон для исходящих через транки
  routes.filter(r => r.type === 'outbound').forEach(route => {
    const trunkId = route.destination.split(':')[1];
    dialplanConf += `exten => _${route.pattern},1,Dial(PJSIP/\${EXTEN}@trunk-${trunkId})\n`;
    dialplanConf += `same => n,Hangup()\n`;
  });

  // IVR Контексты
  ivrs.forEach(ivr => {
    dialplanConf += `\n[miac-ivr-${ivr.id}]\n`;
    dialplanConf += `exten => s,1,Answer()\n`;
    dialplanConf += `same => n,Wait(1)\n`;
    dialplanConf += `same => n,Background(${ivr.announcementFile})\n`;
    dialplanConf += `same => n,WaitExten(5)\n`;
    
    // Кнопки
    (ivr.digitMappings || []).forEach(mapping => {
      const [digit, type, target] = mapping.split(':');
      if (type === 'ext') dialplanConf += `exten => ${digit},1,Dial(PJSIP/${target},30)\n`;
      if (type === 'queue') dialplanConf += `exten => ${digit},1,Queue(${target})\n`;
      if (type === 'ivr') dialplanConf += `exten => ${digit},1,Goto(miac-ivr-${target},s,1)\n`;
    });

    // Таймаут (Секретарь)
    if (ivr.timeoutDestination && ivr.timeoutDestination !== 'hangup') {
      const [type, target] = ivr.timeoutDestination.split(':');
      if (type === 'Extension') dialplanConf += `exten => t,1,Dial(PJSIP/${target},30)\n`;
      if (type === 'Queue') dialplanConf += `exten => t,1,Queue(${target})\n`;
    } else {
      dialplanConf += `exten => t,1,Hangup()\n`;
    }
    dialplanConf += `exten => i,1,Playback(invalid)\n`;
    dialplanConf += `same => n,Goto(s,1)\n`;
  });

  // Входящая маршрутизация
  dialplanConf += '\n[from-trunk]\n';
  routes.filter(r => r.type === 'inbound').forEach(route => {
    const destParts = route.destination.split(':');
    const type = destParts[0];
    const target = destParts[1];
    
    let command = '';
    if (type === 'Extension') command = `Dial(PJSIP/${target},30)`;
    if (type === 'Queue') command = `Queue(${target})`;
    if (type === 'IVR') command = `Goto(miac-ivr-${target},s,1)`;

    if (route.pattern === '*' || route.pattern === 's') {
       dialplanConf += `exten => s,1,${command}\n`;
       dialplanConf += `exten => _.,1,${command}\n`;
    } else {
       dialplanConf += `exten => ${route.pattern},1,${command}\n`;
    }
  });

  // Запись файлов (если есть доступ)
  try {
    fs.writeFileSync(TARGET_CONFS.users, usersConf);
    fs.writeFileSync(TARGET_CONFS.trunks, trunksConf);
    fs.writeFileSync(TARGET_CONFS.dialplan, dialplanConf);
    console.log('--- Конфиги успешно обновлены ---');
  } catch (e) {
    console.error('Ошибка записи в /etc/asterisk/:', e.message);
    console.log('Попробуйте запустить скрипт с правами sudo или chmod 666 /etc/asterisk/*.conf');
  }
}

// Запуск
generateConfig();
