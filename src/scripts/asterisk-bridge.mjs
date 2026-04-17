
import fs from 'fs';
import path from 'path';

/**
 * Скрипт синхронизации данных МИАЦ.СВЯЗЬ с Asterisk.
 * Генерирует конфигурационные файлы на основе JSON данных.
 */

const DATA_DIR = path.join(process.cwd(), 'src/data');
const AST_DIR = '/etc/asterisk';

const FILES = {
  extensions: path.join(DATA_DIR, 'extensions.json'),
  trunks: path.join(DATA_DIR, 'trunks.json'),
  routes: path.join(DATA_DIR, 'routes.json'),
  queues: path.join(DATA_DIR, 'queues.json'),
  ivrs: path.join(DATA_DIR, 'ivrs.json'),
};

const TARGETS = {
  users: path.join(AST_DIR, 'pjsip_miac_users.conf'),
  trunks: path.join(AST_DIR, 'pjsip_miac_trunks.conf'),
  queues: path.join(AST_DIR, 'queues_miac.conf'),
  dialplan: path.join(AST_DIR, 'extensions_miac_dialplan.conf'),
};

function read(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; }
}

function generate() {
  console.log('--- Начинаю синхронизацию с Asterisk ---');
  
  const extensions = read(FILES.extensions);
  const trunks = read(FILES.trunks);
  const routes = read(FILES.routes);
  const queues = read(FILES.queues);
  const ivrs = read(FILES.ivrs);

  // 1. Абоненты (Users)
  let usersConf = '; Сгенерировано МИАЦ.СВЯЗЬ - Абоненты\n\n';
  extensions.forEach(ext => {
    usersConf += `[${ext.id}]\ntype=endpoint\ncontext=miac-internal\ndisallow=all\nallow=ulaw,alaw\nauth=auth-${ext.id}\naors=${ext.id}\ndirect_media=no\nidentify_by=auth_username,username\n\n`;
    usersConf += `[auth-${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
    usersConf += `[${ext.id}]\ntype=aor\nmax_contacts=5\nremove_existing=yes\n\n`;
  });
  fs.writeFileSync(TARGETS.users, usersConf);

  // 2. Транки (Trunks)
  let trunksConf = '; Сгенерировано МИАЦ.СВЯЗЬ - Транки\n\n';
  trunks.forEach(t => {
    const tid = t.id || t.name;
    trunksConf += `[trunk-${tid}]\ntype=endpoint\ncontext=from-trunk\ndisallow=all\nallow=ulaw,alaw\noutbound_auth=auth-${tid}\naors=aor-${tid}\n\n`;
    trunksConf += `[auth-${tid}]\ntype=auth\nauth_type=userpass\nusername=${t.user}\npassword=${t.password}\n\n`;
    trunksConf += `[aor-${tid}]\ntype=aor\ncontact=sip:${t.host}:${t.port}\n\n`;
    trunksConf += `[reg-${tid}]\ntype=registration\nendpoint=trunk-${tid}\noutbound_auth=auth-${tid}\nserver_uri=sip:${t.host}:${t.port}\nclient_uri=sip:${t.user}@${t.host}:${t.port}\n\n`;
    trunksConf += `[identify-${tid}]\ntype=identify\nendpoint=trunk-${tid}\nmatch=${t.host}\n\n`;
  });
  fs.writeFileSync(TARGETS.trunks, trunksConf);

  // 3. Очереди (Queues)
  let queuesConf = '; Сгенерировано МИАЦ.СВЯЗЬ - Группы\n\n';
  queues.forEach(q => {
    queuesConf += `[${q.name}]\nstrategy=${q.strategy}\nmusicclass=${q.musicOnHoldClass || 'default'}\n`;
    (q.members || []).forEach(m => {
      queuesConf += `member => PJSIP/${m}\n`;
    });
    queuesConf += `\n`;
  });
  fs.writeFileSync(TARGETS.queues, queuesConf);

  // 4. Диалплан (Dialplan)
  let dialplan = '; Сгенерировано МИАЦ.СВЯЗЬ - Маршрутизация\n\n[miac-internal]\n';
  // Внутренние звонки
  dialplan += `exten => _XXX,1,Dial(PJSIP/\${EXTEN},30)\n`;
  dialplan += `same => n,Hangup()\n\n`;

  // IVR меню
  ivrs.forEach(ivr => {
    dialplan += `[miac-ivr-${ivr.id}]\n`;
    dialplan += `exten => s,1,Answer()\n`;
    dialplan += `same => n,Wait(1)\n`;
    dialplan += `same => n,Background(${ivr.announcementFile})\n`;
    dialplan += `same => n,WaitExten(5)\n`;
    
    // Таймаут
    if (ivr.timeoutDestination) {
      const parts = ivr.timeoutDestination.split(':');
      if (parts[0] === 'Extension') dialplan += `exten => t,1,Dial(PJSIP/${parts[1]},30)\n`;
      else if (parts[0] === 'Queue') dialplan += `exten => t,1,Queue(${parts[1]})\n`;
      else dialplan += `exten => t,1,Hangup()\n`;
    } else {
      dialplan += `exten => t,1,Hangup()\n`;
    }

    // Кнопки
    (ivr.digitMappings || []).forEach(m => {
      const [digit, type, target] = m.split(':');
      if (type === 'ext') dialplan += `exten => ${digit},1,Dial(PJSIP/${target},30)\n`;
      else if (type === 'queue') dialplan += `exten => ${digit},1,Queue(${target})\n`;
      else if (type === 'ivr') dialplan += `exten => ${digit},1,Goto(miac-ivr-${target},s,1)\n`;
    });
    dialplan += `\n`;
  });

  // Входящие маршруты
  dialplan += `[from-trunk]\n`;
  routes.filter(r => r.type === 'inbound').forEach(r => {
    let target = 'Hangup()';
    if (r.destination.startsWith('IVR:')) target = `Goto(miac-ivr-${r.destination.split(':')[1]},s,1)`;
    else if (r.destination.startsWith('Extension:')) target = `Dial(PJSIP/${r.destination.split(':')[1]},30)`;
    else if (r.destination.startsWith('Queue:')) target = `Queue(${r.destination.split(':')[1]})`;

    if (r.pattern === '*') {
      dialplan += `exten => s,1,${target}\n`;
      dialplan += `exten => _.,1,${target}\n`;
    } else {
      dialplan += `exten => ${r.pattern},1,${target}\n`;
    }
  });

  fs.writeFileSync(TARGETS.dialplan, dialplan);
  console.log('--- Синхронизация завершена успешно ---');
}

generate();
