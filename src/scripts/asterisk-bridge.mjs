
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Asterisk Bridge Script v2.2
 * Синхронизирует JSON базу с конфигами Asterisk (.conf)
 * Оптимизировано для IVR, Identify (No matching endpoint) и Yealink
 */

const DATA_DIR = path.join(process.cwd(), 'src/data');
const SOUNDS_DIR = path.join(process.cwd(), 'src/data/sounds');
const AST_DIR = '/etc/asterisk';

const FILES = {
  users: path.join(AST_DIR, 'pjsip_miac_users.conf'),
  trunks: path.join(AST_DIR, 'pjsip_miac_trunks.conf'),
  dialplan: path.join(AST_DIR, 'extensions_miac_dialplan.conf'),
  queues: path.join(AST_DIR, 'queues_miac.conf'),
};

function readDB(name) {
  const file = path.join(DATA_DIR, `${name}.json`);
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function generateConfigs() {
  console.log('[BRIDGE] Начинаю генерацию конфигураций...');

  // 1. Абоненты (PJSIP)
  let usersConf = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
  const extensions = readDB('extensions');
  extensions.forEach(ext => {
    usersConf += `[${ext.id}]\ntype=endpoint\ncontext=miac-internal\ndisallow=all\nallow=ulaw,alaw\nauth=auth-${ext.id}\naors=${ext.id}\nidentify_by=auth_username,username\n\n`;
    usersConf += `[auth-${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
    usersConf += `[${ext.id}]\ntype=aor\nmax_contacts=2\nremove_existing=yes\n\n`;
  });

  // 2. Транки (PJSIP + Identify)
  let trunksConf = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
  const trunks = readDB('trunks');
  trunks.forEach(t => {
    trunksConf += `[trunk-${t.id}]\ntype=endpoint\ncontext=from-trunk\ndisallow=all\nallow=ulaw,alaw\noutbound_auth=auth-${t.id}\naors=aor-${t.id}\n\n`;
    trunksConf += `[auth-${t.id}]\ntype=auth\nauth_type=userpass\nusername=${t.user}\npassword=${t.password}\n\n`;
    trunksConf += `[aor-${t.id}]\ntype=aor\ncontact=sip:${t.host}:${t.port}\n\n`;
    trunksConf += `[reg-${t.id}]\ntype=registration\nendpoint=trunk-${t.id}\noutbound_auth=auth-${t.id}\nserver_uri=sip:${t.host}:${t.port}\nclient_uri=sip:${t.user}@${t.host}:${t.port}\n\n`;
    trunksConf += `[identify-${t.id}]\ntype=identify\nendpoint=trunk-${t.id}\nmatch=${t.host}\n\n`;
  });

  // 3. Очереди
  let queuesConf = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
  const queues = readDB('queues');
  queues.forEach(q => {
    queuesConf += `[${q.name}]\nstrategy=${q.strategy}\nmusicclass=${q.musicOnHoldClass || 'default'}\ntimeout=15\nretry=5\nwrapuptime=2\n`;
    if (q.members) {
      q.members.forEach(m => {
        queuesConf += `member => PJSIP/${m}\n`;
      });
    }
    queuesConf += `\n`;
  });

  // 4. Диалплан (Internal + Trunk + IVR)
  let dpConf = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
  
  // Внутренняя связь
  dpConf += `[miac-internal]\n`;
  extensions.forEach(ext => {
    dpConf += `exten => ${ext.id},1,Dial(PJSIP/\${EXTEN},30)\n`;
    dpConf += `same => n,Hangup()\n`;
  });
  dpConf += `include => from-internal\n\n`;

  // IVR Сценарии
  const ivrs = readDB('ivrs');
  ivrs.forEach(ivr => {
    const contextName = `miac-ivr-${ivr.id}`;
    dpConf += `[${contextName}]\n`;
    dpConf += `exten => s,1,Answer()\n`;
    dpConf += `same => n,Wait(1)\n`;
    dpConf += `same => n,Background(${ivr.announcementFile})\n`;
    dpConf += `same => n,WaitExten(5)\n\n`;

    // Переходы по кнопкам
    if (ivr.digitMappings) {
      ivr.digitMappings.forEach(m => {
        const [digit, type, target] = m.split(':');
        if (digit && type && target) {
          if (type === 'ext') dpConf += `exten => ${digit},1,Dial(PJSIP/${target},30)\n`;
          else if (type === 'queue') dpConf += `exten => ${digit},1,Queue(${target})\n`;
          else if (type === 'ivr') dpConf += `exten => ${digit},1,Goto(miac-ivr-${target},s,1)\n`;
        }
      });
    }

    // Таймаут (Секретарь)
    if (ivr.timeoutDestination && ivr.timeoutDestination !== 'hangup') {
      const [type, target] = ivr.timeoutDestination.split(':');
      if (type === 'Extension') dpConf += `exten => t,1,Dial(PJSIP/${target},30)\n`;
      else if (type === 'Queue') dpConf += `exten => t,1,Queue(${target})\n`;
    } else {
      dpConf += `exten => t,1,Hangup()\n`;
    }
    
    dpConf += `exten => i,1,Playback(invalid)\nsame => n,Goto(s,1)\n\n`;
  });

  // Входящая маршрутизация (DID -> IVR/EXT)
  dpConf += `[from-trunk]\n`;
  const routes = readDB('routes');
  routes.filter(r => r.type === 'inbound').forEach(r => {
    const targetParts = r.destination.split(':');
    let action = '';
    if (targetParts[0] === 'Extension') action = `Dial(PJSIP/${targetParts[1]},30)`;
    else if (targetParts[0] === 'Queue') action = `Queue(${targetParts[1]})`;
    else if (targetParts[0] === 'IVR') action = `Goto(miac-ivr-${targetParts[1]},s,1)`;

    if (action) {
      if (r.pattern === '*') {
        dpConf += `exten => s,1,${action}\n`;
        dpConf += `exten => _.,1,${action}\n`;
      } else {
        dpConf += `exten => ${r.pattern},1,${action}\n`;
      }
    }
  });

  // Запись файлов
  try {
    fs.writeFileSync(FILES.users, usersConf);
    fs.writeFileSync(FILES.trunks, trunksConf);
    fs.writeFileSync(FILES.queues, queuesConf);
    fs.writeFileSync(FILES.dialplan, dpConf);
    console.log('[BRIDGE] Конфигурации успешно обновлены.');
    
    // Перезагрузка Asterisk
    execSync('asterisk -rx "core reload"');
    console.log('[BRIDGE] Asterisk перезагружен.');
  } catch (err) {
    console.error('[BRIDGE] Ошибка при записи файлов. Проверьте права (chmod 666 /etc/asterisk/*.conf)');
  }
}

// Первоначальный запуск
generateConfigs();

// Наблюдение за изменениями в JSON файлах
fs.watch(DATA_DIR, (eventType, filename) => {
  if (filename && filename.endsWith('.json')) {
    console.log(`[BRIDGE] Файл ${filename} изменен. Перегенерация...`);
    generateConfigs();
  }
});
