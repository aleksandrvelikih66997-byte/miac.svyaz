import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

const DATA_DIR = path.join(process.cwd(), 'src/data');
const SOUNDS_DIR = path.join(DATA_DIR, 'sounds');
const AST_CONF_DIR = '/etc/asterisk';
const AST_SOUNDS_DIR = '/var/lib/asterisk/sounds';

// Ensure data directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(SOUNDS_DIR)) fs.mkdirSync(SOUNDS_DIR, { recursive: true });

const FILES = {
  extensions: path.join(DATA_DIR, 'extensions.json'),
  trunks: path.join(DATA_DIR, 'trunks.json'),
  routes: path.join(DATA_DIR, 'routes.json'),
  queues: path.join(DATA_DIR, 'queues.json'),
  ivrs: path.join(DATA_DIR, 'ivrs.json'),
};

const AST_FILES = {
  users: path.join(AST_CONF_DIR, 'pjsip_miac_users.conf'),
  trunks: path.join(AST_CONF_DIR, 'pjsip_miac_trunks.conf'),
  queues: path.join(AST_CONF_DIR, 'queues_miac.conf'),
  dialplan: path.join(AST_CONF_DIR, 'extensions_miac_dialplan.conf'),
};

console.log("🚀 [BRIDGE] Мост МИАЦ.СВЯЗЬ запущен...");

function reloadAsterisk(module) {
  let cmd = '';
  if (module === 'pjsip') cmd = 'asterisk -rx "pjsip reload"';
  if (module === 'dialplan') cmd = 'asterisk -rx "dialplan reload"';
  if (module === 'queues') cmd = 'asterisk -rx "queue reload all"';

  if (cmd) {
    exec(cmd, (err) => {
      if (err) console.error(`❌ [BRIDGE] Ошибка перезагрузки ${module}:`, err.message);
      else console.log(`✅ [BRIDGE] Модуль ${module} успешно перезагружен.`);
    });
  }
}

function syncSounds() {
  if (!fs.existsSync(AST_SOUNDS_DIR)) {
    console.warn(`⚠️ [BRIDGE] Системная папка звуков Asterisk не найдена: ${AST_SOUNDS_DIR}`);
    return;
  }
  
  const files = fs.readdirSync(SOUNDS_DIR);
  files.forEach(file => {
    const src = path.join(SOUNDS_DIR, file);
    const dest = path.join(AST_SOUNDS_DIR, file);
    try {
      fs.copyFileSync(src, dest);
      fs.chmodSync(dest, 0o666);
    } catch (e) {
      console.error(`❌ [BRIDGE] Ошибка копирования звука ${file}:`, e.message);
    }
  });
}

function generateConfigs() {
  try {
    // 1. АБОНЕНТЫ (PJSIP)
    const exts = JSON.parse(fs.readFileSync(FILES.extensions, 'utf8') || '[]');
    let usersConf = "; Генерируемый файл абонентов МИАЦ\n\n";
    exts.forEach(e => {
      usersConf += `[${e.id}]\ntype=endpoint\nauth=auth${e.id}\naors=${e.id}\ncontext=from-internal\ndisallow=all\nallow=ulaw,alaw,g722\nidentify_by=username\nrtp_symmetric=yes\nrewrite_contact=yes\ndirect_media=no\n\n`;
      usersConf += `[auth${e.id}]\ntype=auth\nauth_type=userpass\nusername=${e.id}\npassword=${e.secret}\n\n`;
      usersConf += `[${e.id}]\ntype=aor\nmax_contacts=1\nremove_existing=yes\n\n`;
    });
    fs.writeFileSync(AST_FILES.users, usersConf);

    // 2. ТРАНКИ (PJSIP)
    const trunks = JSON.parse(fs.readFileSync(FILES.trunks, 'utf8') || '[]');
    let trunksConf = "; Генерируемый файл транков МИАЦ\n\n";
    trunks.forEach(t => {
      trunksConf += `[registration-${t.id}]\ntype=registration\nserver_uri=sip:${t.host}:${t.port}\nclient_uri=sip:${t.user}@${t.host}:${t.port}\noutbound_auth=auth-${t.id}\n\n`;
      trunksConf += `[auth-${t.id}]\ntype=auth\nauth_type=userpass\nusername=${t.user}\npassword=${t.password}\n\n`;
      trunksConf += `[trunk-${t.id}]\ntype=endpoint\ncontext=from-trunk\ndisallow=all\nallow=ulaw,alaw\noutbound_auth=auth-${t.id}\naors=aor-${t.id}\n\n`;
      trunksConf += `[aor-${t.id}]\ntype=aor\ncontact=sip:${t.host}:${t.port}\n\n`;
      trunksConf += `[identify-${t.id}]\ntype=identify\nendpoint=trunk-${t.id}\nmatch=${t.host}\n\n`;
    });
    fs.writeFileSync(AST_FILES.trunks, trunksConf);

    // 3. ОЧЕРЕДИ (ГРУППЫ)
    const queues = JSON.parse(fs.readFileSync(FILES.queues, 'utf8') || '[]');
    let queuesConf = "; Генерируемый файл очередей МИАЦ\n\n";
    queues.forEach(q => {
      queuesConf += `[${q.name}]\nstrategy=${q.strategy}\nmusicclass=${q.musicOnHoldClass || 'default'}\ntimeout=15\nretry=5\nwrapuptime=0\n`;
      (q.members || []).forEach(m => {
        queuesConf += `member => PJSIP/${m}\n`;
      });
      queuesConf += `\n`;
    });
    fs.writeFileSync(AST_FILES.queues, queuesConf);

    // 4. ДИАЛПЛАН
    const routes = JSON.parse(fs.readFileSync(FILES.routes, 'utf8') || '[]');
    const ivrs = JSON.parse(fs.readFileSync(FILES.ivrs, 'utf8') || '[]');
    
    let dialplan = "; Генерируемый файл маршрутизации МИАЦ\n\n";
    
    // Внутренняя связь
    dialplan += "[from-internal]\n";
    exts.forEach(e => {
      dialplan += `exten => ${e.id},1,Dial(PJSIP/${e.id},30)\n`;
      dialplan += `same => n,Hangup()\n`;
    });

    // Исходящие через транки
    routes.filter(r => r.type === 'outbound').forEach(r => {
      const trunkId = r.destination.split(':')[1];
      dialplan += `exten => _${r.pattern},1,Dial(PJSIP/\${EXTEN}@trunk-${trunkId})\n`;
      dialplan += `same => n,Hangup()\n`;
    });

    // Входящие (from-trunk)
    dialplan += "\n[from-trunk]\n";
    routes.filter(r => r.type === 'inbound').forEach(r => {
      const [type, id] = r.destination.split(':');
      if (type === 'Extension') dialplan += `exten => ${r.pattern},1,Goto(from-internal,${id},1)\n`;
      if (type === 'Queue') dialplan += `exten => ${r.pattern},1,Queue(${id})\n`;
      if (type === 'IVR') dialplan += `exten => ${r.pattern},1,Goto(ivr-${id},s,1)\n`;
    });

    // IVR Секции
    ivrs.forEach(ivr => {
      dialplan += `\n[ivr-${ivr.id}]\n`;
      dialplan += `exten => s,1,Answer()\n`;
      dialplan += `same => n,Background(${ivr.announcementFile})\n`;
      dialplan += `same => n,WaitExten(5)\n`;
      
      (ivr.digitMappings || []).forEach(m => {
        const [digit, type, target] = m.split(':');
        if (type === 'ext') dialplan += `exten => ${digit},1,Goto(from-internal,${target},1)\n`;
        if (type === 'queue') dialplan += `exten => ${digit},1,Queue(${target})\n`;
        if (type === 'ivr') dialplan += `exten => ${digit},1,Goto(ivr-${target},s,1)\n`;
      });
      dialplan += `exten => i,1,Playback(invalid)\n`;
      dialplan += `same => n,Goto(s,1)\n`;
      dialplan += `exten => t,1,Hangup()\n`;
    });

    fs.writeFileSync(AST_FILES.dialplan, dialplan);

    console.log("📝 [BRIDGE] Конфигурации обновлены.");
    reloadAsterisk('pjsip');
    reloadAsterisk('dialplan');
    reloadAsterisk('queues');
    syncSounds();
    
  } catch (err) {
    console.error("❌ [BRIDGE] Ошибка генерации:", err.message);
  }
}

// Watcher
fs.watch(DATA_DIR, (event, filename) => {
  if (filename && filename.endsWith('.json')) {
    console.log(`🔔 [BRIDGE] Изменен файл: ${filename}`);
    generateConfigs();
  }
});

fs.watch(SOUNDS_DIR, (event, filename) => {
  console.log(`🔔 [BRIDGE] Изменение в папке звуков: ${filename}`);
  syncSounds();
});

// Initial run
generateConfigs();