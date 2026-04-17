
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'src/data');
const CONF_DIR = '/etc/asterisk';

const FILES = {
  extensions: path.join(DATA_DIR, 'extensions.json'),
  trunks: path.join(DATA_DIR, 'trunks.json'),
  routes: path.join(DATA_DIR, 'routes.json'),
  queues: path.join(DATA_DIR, 'queues.json'),
  ivrs: path.join(DATA_DIR, 'ivrs.json'),
};

const OUTPUT = {
  users: path.join(CONF_DIR, 'pjsip_miac_users.conf'),
  trunks: path.join(CONF_DIR, 'pjsip_miac_trunks.conf'),
  queues: path.join(CONF_DIR, 'queues_miac.conf'),
  dialplan: path.join(CONF_DIR, 'extensions_miac_dialplan.conf'),
};

function readJSON(file) {
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return [];
  }
}

function runBridge() {
  console.log('[BRIDGE] Запуск генерации конфигураций...');

  const extensions = readJSON(FILES.extensions);
  const trunks = readJSON(FILES.trunks);
  const routes = readJSON(FILES.routes);
  const queues = readJSON(FILES.queues);
  const ivrs = readJSON(FILES.ivrs);

  // 1. Абоненты (PJSIP)
  let usersConf = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
  extensions.forEach(ext => {
    usersConf += `[${ext.id}]\ntype=endpoint\ncontext=miac-internal\ndisallow=all\nallow=ulaw,alaw,g722\nauth=auth-${ext.id}\naors=${ext.id}\nidentify_by=auth_username,username\n\n`;
    usersConf += `[auth-${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
    usersConf += `[${ext.id}]\ntype=aor\nmax_contacts=5\n\n`;
  });
  fs.writeFileSync(OUTPUT.users, usersConf);

  // 2. Транки (PJSIP + Identify)
  let trunksConf = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
  trunks.forEach(trunk => {
    trunksConf += `[trunk-${trunk.id}]\ntype=endpoint\ncontext=from-trunk\ndisallow=all\nallow=ulaw,alaw\noutbound_auth=auth-${trunk.id}\naors=aor-${trunk.id}\n\n`;
    trunksConf += `[auth-${trunk.id}]\ntype=auth\nauth_type=userpass\nusername=${trunk.user}\npassword=${trunk.password}\n\n`;
    trunksConf += `[aor-${trunk.id}]\ntype=aor\ncontact=sip:${trunk.host}:${trunk.port}\n\n`;
    trunksConf += `[reg-${trunk.id}]\ntype=registration\nendpoint=trunk-${trunk.id}\noutbound_auth=auth-${trunk.id}\nserver_uri=sip:${trunk.host}:${trunk.port}\nclient_uri=sip:${trunk.user}@${trunk.host}:${trunk.port}\n\n`;
    trunksConf += `[identify-${trunk.id}]\ntype=identify\nendpoint=trunk-${trunk.id}\nmatch=${trunk.host}\n\n`;
  });
  fs.writeFileSync(OUTPUT.trunks, trunksConf);

  // 3. Диалплан
  let dialplanConf = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
  
  // Внутренняя связь
  dialplanConf += '[miac-internal]\n';
  dialplanConf += 'exten => _XXX,1,Dial(PJSIP/${EXTEN},30)\n';
  dialplanConf += 'same => n,Hangup()\n\n';

  // Голосовые меню (IVR)
  ivrs.forEach(ivr => {
    dialplanConf += `[miac-ivr-${ivr.id}]\n`;
    dialplanConf += `exten => s,1,Answer()\n`;
    dialplanConf += `same => n,Background(${ivr.announcementFile})\n`;
    dialplanConf += `same => n,WaitExten(5)\n`;
    
    // Переход по кнопкам
    (ivr.digitMappings || []).forEach(m => {
      const [digit, type, target] = m.split(':');
      if (type === 'ext') dialplanConf += `exten => ${digit},1,Dial(PJSIP/${target},30)\n`;
      if (type === 'queue') dialplanConf += `exten => ${digit},1,Queue(${target})\n`;
      if (type === 'ivr') dialplanConf += `exten => ${digit},1,Goto(miac-ivr-${target},s,1)\n`;
    });

    // Таймаут
    if (ivr.timeoutDestination && ivr.timeoutDestination !== 'hangup') {
      const [tType, tTarget] = ivr.timeoutDestination.split(':');
      dialplanConf += `exten => t,1,${tType === 'Extension' ? 'Dial(PJSIP/' + tTarget + ',30)' : 'Queue(' + tTarget + ')'}\n`;
    } else {
      dialplanConf += `exten => t,1,Hangup()\n`;
    }
    dialplanConf += `exten => i,1,Playback(invalid)\nsame => n,Goto(s,1)\n\n`;
  });

  // Входящая маршрутизация
  dialplanConf += '[from-trunk]\n';
  routes.filter(r => r.type === 'inbound').forEach(route => {
    const [dType, dId] = route.destination.split(':');
    const target = dType === 'IVR' ? `miac-ivr-${dId},s,1` : (dType === 'Extension' ? `miac-internal,${dId},1` : `${dId}`);
    
    if (route.pattern === '*') {
      dialplanConf += `exten => s,1,Goto(${target})\n`;
      dialplanConf += `exten => _.,1,Goto(${target})\n`;
    } else {
      dialplanConf += `exten => ${route.pattern},1,Goto(${target})\n`;
    }
  });
  
  fs.writeFileSync(OUTPUT.dialplan, dialplanConf);

  console.log('[BRIDGE] Конфигурации успешно обновлены.');
}

runBridge();
