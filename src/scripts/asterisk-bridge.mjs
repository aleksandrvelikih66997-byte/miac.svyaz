
import fs from 'fs';
import path from 'path';

/**
 * Скрипт синхронизации данных из МИАЦ.СВЯЗЬ в конфигурационные файлы Asterisk.
 * Оптимизировано под Asterisk 17/20 и AltLinux SP 10.
 */

const DATA_DIR = path.join(process.cwd(), 'src/data');
const SOUNDS_SRC_DIR = path.join(DATA_DIR, 'sounds');
const ASTERISK_CONF_DIR = '/etc/asterisk';
const ASTERISK_SOUNDS_DIR = '/var/lib/asterisk/sounds/miac';

function readData(name) {
  const file = path.join(DATA_DIR, `${name}.json`);
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sync() {
  console.log('[BRIDGE] Начинаю синхронизацию...');

  // 1. Синхронизация звуковых файлов (если есть доступ к директориям)
  try {
    if (fs.existsSync(SOUNDS_SRC_DIR)) {
      if (!fs.existsSync(ASTERISK_SOUNDS_DIR)) {
        fs.mkdirSync(ASTERISK_SOUNDS_DIR, { recursive: true });
      }
      const files = fs.readdirSync(SOUNDS_SRC_DIR);
      files.forEach(f => {
        const src = path.join(SOUNDS_SRC_DIR, f);
        const dest = path.join(ASTERISK_SOUNDS_DIR, f);
        if (!fs.existsSync(dest)) {
          fs.copyFileSync(src, dest);
          fs.chmodSync(dest, 0o666);
        }
      });
    }
  } catch (e) {
    console.warn('[BRIDGE] Ошибка копирования звуков (возможно, нет прав):', e.message);
  }

  // 2. Генерация pjsip_miac_users.conf
  const extensions = readData('extensions');
  let usersConf = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
  extensions.forEach(ext => {
    usersConf += `[${ext.id}]\ntype=endpoint\ncontext=miac-internal\ndisallow=all\nallow=ulaw,alaw\nauth=auth-${ext.id}\naors=${ext.id}\n\n`;
    usersConf += `[auth-${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
    usersConf += `[${ext.id}]\ntype=aor\nmax_contacts=1\n\n`;
  });
  fs.writeFileSync(path.join(ASTERISK_CONF_DIR, 'pjsip_miac_users.conf'), usersConf);

  // 3. Генерация pjsip_miac_trunks.conf
  const trunks = readData('trunks');
  let trunksConf = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
  trunks.forEach(t => {
    trunksConf += `[trunk-${t.id}]\ntype=endpoint\ncontext=from-trunk\ndisallow=all\nallow=ulaw,alaw\noutbound_auth=auth-${t.id}\naors=aor-${t.id}\n\n`;
    trunksConf += `[auth-${t.id}]\ntype=auth\nauth_type=userpass\nusername=${t.user}\npassword=${t.password}\n\n`;
    trunksConf += `[aor-${t.id}]\ntype=aor\ncontact=sip:${t.host}:${t.port}\n\n`;
    trunksConf += `[reg-${t.id}]\ntype=registration\noutbound_auth=auth-${t.id}\nserver_uri=sip:${t.host}:${t.port}\nclient_uri=sip:${t.user}@${t.host}:${t.port}\nretry_interval=60\nexpiration=120\n\n`;
    trunksConf += `[identify-${t.id}]\ntype=identify\nendpoint=trunk-${t.id}\nmatch=${t.host}\n\n`;
  });
  fs.writeFileSync(path.join(ASTERISK_CONF_DIR, 'pjsip_miac_trunks.conf'), trunksConf);

  // 4. Генерация extensions_miac_dialplan.conf
  const routes = readData('routes');
  const ivrs = readData('ivrs');
  let dialplan = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n[miac-internal]\n';
  dialplan += 'exten => _XXX,1,Dial(PJSIP/${EXTEN},30)\nexten => _XXX,n,Hangup()\n\n';

  // Входящий контекст
  dialplan += '[from-trunk]\n';
  routes.filter(r => r.type === 'inbound').forEach(r => {
    const target = r.destination.split(':');
    if (target[0] === 'IVR') {
      dialplan += `exten => s,1,Goto(miac-ivr-${target[1]},s,1)\n`;
      dialplan += `exten => _.,1,Goto(miac-ivr-${target[1]},s,1)\n`;
    } else if (target[0] === 'Extension') {
      dialplan += `exten => s,1,Dial(PJSIP/${target[1]},30)\n`;
      dialplan += `exten => _.,1,Dial(PJSIP/${target[1]},30)\n`;
    }
  });

  // IVR меню
  ivrs.forEach(ivr => {
    dialplan += `\n[miac-ivr-${ivr.id}]\n`;
    dialplan += `exten => s,1,Answer()\n`;
    dialplan += `exten => s,n,Progress()\n`;
    dialplan += `exten => s,n,Wait(1)\n`;
    // Используем путь относительно системной папки звуков или абсолютный
    const soundPath = `miac/${ivr.announcementFile}`;
    dialplan += `exten => s,n,Background(${soundPath})\n`;
    dialplan += `exten => s,n,WaitExten(5)\n`;

    // Кнопки
    (ivr.digitMappings || []).forEach(m => {
      const [digit, type, targetId] = m.split(':');
      if (type === 'ext') dialplan += `exten => ${digit},1,Dial(PJSIP/${targetId},30)\n`;
      else if (type === 'queue') dialplan += `exten => ${digit},1,Queue(${targetId})\n`;
    });

    // Таймаут
    if (ivr.timeoutDestination) {
      const [tType, tId] = ivr.timeoutDestination.split(':');
      if (tType === 'Extension') dialplan += `exten => t,1,Dial(PJSIP/${tId},30)\n`;
      else if (tType === 'Queue') dialplan += `exten => t,1,Queue(${tId})\n`;
    } else {
      dialplan += `exten => t,1,Hangup()\n`;
    }
    dialplan += `exten => i,1,Playback(invalid)\nexten => i,n,Goto(s,1)\n`;
  });

  fs.writeFileSync(path.join(ASTERISK_CONF_DIR, 'extensions_miac_dialplan.conf'), dialplan);

  // 5. Группы (queues_miac.conf)
  const queues = readData('queues');
  let queuesConf = '; Сгенерировано МИАЦ.СВЯЗЬ\n\n';
  queues.forEach(q => {
    queuesConf += `[${q.name}]\nstrategy=${q.strategy}\nmusicclass=${q.musicOnHoldClass}\n`;
    (q.members || []).forEach(m => {
      queuesConf += `member => PJSIP/${m}\n`;
    });
    queuesConf += '\n';
  });
  fs.writeFileSync(path.join(ASTERISK_CONF_DIR, 'queues_miac.conf'), queuesConf);

  console.log('[BRIDGE] Синхронизация завершена успешно.');
}

sync();
