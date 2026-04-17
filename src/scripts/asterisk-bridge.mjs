import fs from 'fs';
import path from 'path';

/**
 * Скрипт синхронизации данных панели управления с конфигурационными файлами Asterisk.
 * Генерирует pjsip.conf, queues.conf и extensions.conf.
 */

const DATA_DIR = path.join(process.cwd(), 'src/data');
const AST_DIR = '/etc/asterisk';

const FILES = {
  ext: path.join(DATA_DIR, 'extensions.json'),
  trunks: path.join(DATA_DIR, 'trunks.json'),
  routes: path.join(DATA_DIR, 'routes.json'),
  queues: path.join(DATA_DIR, 'queues.json'),
  ivrs: path.join(DATA_DIR, 'ivrs.json'),
  sounds: path.join(DATA_DIR, 'sounds'),
};

const AST_TARGETS = {
  users: path.join(AST_DIR, 'pjsip_miac_users.conf'),
  trunks: path.join(AST_DIR, 'pjsip_miac_trunks.conf'),
  queues: path.join(AST_DIR, 'queues_miac.conf'),
  dialplan: path.join(AST_DIR, 'extensions_miac_dialplan.conf'),
  sounds: '/var/lib/asterisk/sounds/miac',
};

function readJSON(file) {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

async function sync() {
  console.log('--- STARTING MIAC ASTERISK SYNC ---');

  // 1. АБОНЕНТЫ
  const extensions = readJSON(FILES.ext);
  let usersConfig = '; Генерируемый файл абонентов МИАЦ\n\n';
  extensions.forEach(ext => {
    usersConfig += `[${ext.id}]\ntype=endpoint\nauth=auth-${ext.id}\naors=${ext.id}\ncontext=miac-internal\ndisallow=all\nallow=ulaw,alaw\n\n`;
    usersConfig += `[auth-${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
    usersConfig += `[${ext.id}]\ntype=aor\nmax_contacts=1\n\n`;
  });
  fs.writeFileSync(AST_TARGETS.users, usersConfig);

  // 2. ТРАНКИ (Согласно вашему образцу)
  const trunks = readJSON(FILES.trunks);
  let trunksConfig = '; Генерируемый файл транков МИАЦ\n\n';
  trunks.forEach(t => {
    trunksConfig += `[trunk-${t.id}]\ntype=endpoint\ncontext=from-trunk\ndisallow=all\nallow=ulaw,alaw\noutbound_auth=auth-${t.id}\naors=aor-${t.id}\n\n`;
    trunksConfig += `[auth-${t.id}]\ntype=auth\nauth_type=userpass\nusername=${t.user}\npassword=${t.password}\n\n`;
    trunksConfig += `[aor-${t.id}]\ntype=aor\ncontact=sip:${t.host}:${t.port}\n\n`;
    trunksConfig += `[reg-${t.id}]\ntype=registration\noutbound_auth=auth-${t.id}\nserver_uri=sip:${t.host}:${t.port}\nclient_uri=sip:${t.user}@${t.host}:${t.port}\nretry_interval=60\nexpiration=120\n\n`;
    trunksConfig += `[identify-${t.id}]\ntype=identify\nendpoint=trunk-${t.id}\nmatch=${t.host}\n\n`;
  });
  fs.writeFileSync(AST_TARGETS.trunks, trunksConfig);

  // 3. ОЧЕРЕДИ
  const queues = readJSON(FILES.queues);
  let queuesConfig = '; Генерируемый файл очередей МИАЦ\n\n';
  queues.forEach(q => {
    queuesConfig += `[${q.name}]\nstrategy=${q.strategy}\nmusicclass=${q.musicOnHoldClass || 'default'}\ntimeout=15\nretry=5\nwrapuptime=0\n`;
    (q.members || []).forEach(m => {
      queuesConfig += `member => PJSIP/${m}\n`;
    });
    queuesConfig += '\n';
  });
  fs.writeFileSync(AST_TARGETS.queues, queuesConfig);

  // 4. ДИАЛПЛАН И IVR
  const ivrs = readJSON(FILES.ivrs);
  const routes = readJSON(FILES.routes);
  let dialplan = '; Генерируемый диалплан МИАЦ\n\n';

  // Входящий контекст (Маршрутизация)
  dialplan += '[from-trunk]\n';
  const inboundRoutes = routes.filter(r => r.type === 'inbound');
  inboundRoutes.forEach(r => {
    const exten = r.pattern === '*' ? 's' : r.pattern;
    const destParts = r.destination.split(':');
    if (destParts[0] === 'IVR') {
      dialplan += `exten => ${exten},1,Goto(miac-ivr-${destParts[1]},s,1)\n`;
      if (exten === 's') dialplan += `exten => _.,1,Goto(miac-ivr-${destParts[1]},s,1)\n`;
    } else if (destParts[0] === 'Extension') {
      dialplan += `exten => ${exten},1,Dial(PJSIP/${destParts[1]},30)\n`;
    } else if (destParts[0] === 'Queue') {
      dialplan += `exten => ${exten},1,Queue(${destParts[1]})\n`;
    }
  });
  dialplan += 'exten => s,n,Hangup()\n\n';

  // Контексты IVR
  ivrs.forEach(ivr => {
    dialplan += `[miac-ivr-${ivr.id}]\n`;
    dialplan += 'exten => s,1,Answer()\n';
    dialplan += 'exten => s,n,Progress()\n';
    dialplan += 'exten => s,n,Wait(1)\n';
    // Воспроизводим файл. Asterisk ищет его в системном пути.
    dialplan += `exten => s,n,Background(miac/${ivr.announcementFile})\n`;
    dialplan += 'exten => s,n,WaitExten(5)\n';
    
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
    dialplan += '\n';
  });

  // Внутренние звонки
  dialplan += '[miac-internal]\n';
  dialplan += 'exten => _XXX,1,Dial(PJSIP/${EXTEN},30)\n';
  dialplan += 'exten => _XXX,n,Hangup()\n\n';

  fs.writeFileSync(AST_TARGETS.dialplan, dialplan);

  // 5. КОПИРОВАНИЕ ЗВУКОВ
  if (fs.existsSync(FILES.sounds)) {
    try {
      if (!fs.existsSync(AST_TARGETS.sounds)) {
        fs.mkdirSync(AST_TARGETS.sounds, { recursive: true });
      }
      const files = fs.readdirSync(FILES.sounds);
      files.forEach(f => {
        fs.copyFileSync(path.join(FILES.sounds, f), path.join(AST_TARGETS.sounds, f));
      });
      console.log(`Copied ${files.length} sound files to Asterisk sounds dir.`);
    } catch (e) {
      console.warn('Error syncing sound files. Check permissions for /var/lib/asterisk/sounds/miac/');
    }
  }

  console.log('--- SYNC COMPLETE ---');
}

sync().catch(console.error);
