
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '../../');
const DATA_DIR = path.join(ROOT_DIR, 'src/data');
const SOUNDS_DIR = path.join(DATA_DIR, 'sounds');
const ASTERISK_SOUNDS_DIR = '/var/lib/asterisk/sounds/ru/';

// Пути к файлам Asterisk
const PJSIP_USERS = '/etc/asterisk/pjsip_miac_users.conf';
const PJSIP_TRUNKS = '/etc/asterisk/pjsip_miac_trunks.conf';
const QUEUES_CONF = '/etc/asterisk/queues_miac.conf';
const DIALPLAN_CONF = '/etc/asterisk/extensions_miac_dialplan.conf';

function log(msg) { console.log(`[${new Date().toLocaleTimeString()}] BRIDGE: ${msg}`); }

async function syncData() {
  log("Начало синхронизации данных...");

  // 1. АБОНЕНТЫ (PJSIP)
  const extFile = path.join(DATA_DIR, 'extensions.json');
  if (fs.existsSync(extFile)) {
    const extensions = JSON.parse(fs.readFileSync(extFile, 'utf8'));
    let pjsipContent = "; Сгенерировано МИАЦ.СВЯЗЬ\n\n";
    
    extensions.forEach(ext => {
      pjsipContent += `[${ext.id}]\ntype=endpoint\ncontext=from-internal\ndisallow=all\nallow=ulaw,alaw,g722\nauth=auth-${ext.id}\naors=${ext.id}\nidentify_by=auth_username,username\n\n`;
      pjsipContent += `[auth-${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
      pjsipContent += `[${ext.id}]\ntype=aor\nmax_contacts=5\nremove_existing=yes\n\n`;
    });
    
    try { fs.writeFileSync(PJSIP_USERS, pjsipContent); } catch(e) { log("ERR: Ошибка записи PJSIP_USERS"); }
  }

  // 2. ТРАНКИ (PJSIP)
  const trunkFile = path.join(DATA_DIR, 'trunks.json');
  if (fs.existsSync(trunkFile)) {
    const trunks = JSON.parse(fs.readFileSync(trunkFile, 'utf8'));
    let trunksContent = "; Сгенерировано МИАЦ.СВЯЗЬ\n\n";
    
    trunks.forEach(t => {
      const tid = t.id || t.name.toLowerCase().replace(/\s+/g, '-');
      trunksContent += `[trunk-${tid}]\ntype=endpoint\ncontext=from-trunk\ndisallow=all\nallow=ulaw,alaw\noutbound_auth=auth-${tid}\naors=aor-${tid}\n\n`;
      trunksContent += `[auth-${tid}]\ntype=auth\nauth_type=userpass\nusername=${t.user}\npassword=${t.password}\n\n`;
      trunksContent += `[aor-${tid}]\ntype=aor\ncontact=sip:${t.host}:${t.port}\n\n`;
      trunksContent += `[reg-${tid}]\ntype=registration\nendpoint=trunk-${tid}\noutbound_auth=auth-${tid}\nserver_uri=sip:${t.host}:${t.port}\nclient_uri=sip:${t.user}@${t.host}:${t.port}\n\n`;
      trunksContent += `[identify-${tid}]\ntype=identify\nendpoint=trunk-${tid}\nmatch=${t.host}\n\n`;
    });
    
    try { fs.writeFileSync(PJSIP_TRUNKS, trunksContent); } catch(e) { log("ERR: Ошибка записи PJSIP_TRUNKS"); }
  }

  // 3. ОЧЕРЕДИ
  const queueFile = path.join(DATA_DIR, 'queues.json');
  if (fs.existsSync(queueFile)) {
    const queues = JSON.parse(fs.readFileSync(queueFile, 'utf8'));
    let qContent = "; Сгенерировано МИАЦ.СВЯЗЬ\n\n";
    
    queues.forEach(q => {
      qContent += `[${q.name}]\nstrategy=${q.strategy}\nmusiconhold=${q.musicOnHoldClass || 'default'}\ntimeout=15\nretry=5\nwrapuptime=10\n`;
      (q.members || []).forEach(m => {
        qContent += `member => PJSIP/${m}\n`;
      });
      qContent += "\n";
    });
    
    try { fs.writeFileSync(QUEUES_CONF, qContent); } catch(e) { log("ERR: Ошибка записи QUEUES_CONF"); }
  }

  // 4. ДИАЛПЛАН (IVR + МАРШРУТЫ)
  const routeFile = path.join(DATA_DIR, 'routes.json');
  const ivrFile = path.join(DATA_DIR, 'ivrs.json');
  
  let dContent = "[from-internal]\n";
  dContent += "exten => _XXX,1,Dial(PJSIP/${EXTEN},30)\n";
  dContent += "exten => _XXX,n,Hangup()\n\n";

  // IVR Контексты
  if (fs.existsSync(ivrFile)) {
    const ivrs = JSON.parse(fs.readFileSync(ivrFile, 'utf8'));
    ivrs.forEach(ivr => {
      dContent += `[miac-ivr-${ivr.id}]\n`;
      dContent += `exten => s,1,Answer()\n`;
      dContent += `exten => s,n,Set(TIMEOUT(digit)=2)\n`;
      dContent += `exten => s,n,Background(${ivr.announcementFile})\n`;
      dContent += `exten => s,n,WaitExten(5)\n`;
      
      // Обработка кнопок
      (ivr.digitMappings || []).forEach(m => {
        const [digit, type, target] = m.split(':');
        let action = "";
        if (type === 'ext') action = `Dial(PJSIP/${target},30)`;
        else if (type === 'queue') action = `Queue(${target})`;
        else if (type === 'ivr') action = `Goto(miac-ivr-${target},s,1)`;
        
        dContent += `exten => ${digit},1,${action}\n`;
      });
      
      // Таймаут
      if (ivr.timeoutDestination && ivr.timeoutDestination !== 'hangup') {
        const [tType, tId] = ivr.timeoutDestination.split(':');
        let tAction = "";
        if (tType === 'Extension') tAction = `Dial(PJSIP/${tId},30)`;
        else if (tType === 'Queue') tAction = `Queue(${tId})`;
        dContent += `exten => t,1,${tAction}\n`;
      } else {
        dContent += `exten => t,1,Hangup()\n`;
      }
      dContent += `exten => i,1,Playback(invalid)\n`;
      dContent += `exten => i,n,Goto(s,1)\n\n`;
    });
  }

  // Входящие
  dContent += "[from-trunk]\n";
  if (fs.existsSync(routeFile)) {
    const routes = JSON.parse(fs.readFileSync(routeFile, 'utf8'));
    routes.filter(r => r.type === 'inbound').forEach(r => {
      let dest = "";
      if (r.destination.startsWith('Extension:')) dest = `Dial(PJSIP/${r.destination.split(':')[1]},30)`;
      else if (r.destination.startsWith('Queue:')) dest = `Queue(${r.destination.split(':')[1]})`;
      else if (r.destination.startsWith('IVR:')) dest = `Goto(miac-ivr-${r.destination.split(':')[1]},s,1)`;
      
      dContent += `exten => ${r.pattern},1,${dest}\n`;
      dContent += `exten => s,1,${dest}\n`; // Fallback для 's'
    });
  }

  try { fs.writeFileSync(DIALPLAN_CONF, dContent); } catch(e) { log("ERR: Ошибка записи DIALPLAN_CONF"); }

  // 5. КОПИРОВАНИЕ ЗВУКОВ
  if (fs.existsSync(SOUNDS_DIR)) {
    const files = fs.readdirSync(SOUNDS_DIR);
    files.forEach(f => {
      const src = path.join(SOUNDS_DIR, f);
      const dest = path.join(ASTERISK_SOUNDS_DIR, f);
      if (fs.existsSync(ASTERISK_SOUNDS_DIR)) {
        try { fs.copyFileSync(src, dest); fs.chmodSync(dest, 0o666); } catch(e) {}
      }
    });
  }

  log("Синхронизация завершена. Применяем конфиг в Asterisk...");
  // Выполнение команд перезагрузки (требует sudo или прав на asterisk)
  // exec('asterisk -rx "core reload"');
}

// Запуск при старте и слежение за изменениями
syncData();
setInterval(syncData, 5000); // Опрашиваем раз в 5 секунд
