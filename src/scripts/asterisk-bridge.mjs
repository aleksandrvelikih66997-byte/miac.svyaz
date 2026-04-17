
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import asteriskManager from 'asterisk-manager';

const DATA_DIR = path.join(process.cwd(), 'src/data');
const SOUNDS_DIR = path.join(process.cwd(), 'src/data/sounds');
const AST_CONF_DIR = '/etc/asterisk';
const AST_SOUNDS_DIR = '/var/lib/asterisk/sounds';

// Создаем папки если их нет
[DATA_DIR, SOUNDS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const ami = asteriskManager(5038, '127.0.0.1', 'miac', 'MiacAMI2026', true);

function reloadAsterisk(module) {
  const cmd = module ? `module reload ${module}` : 'core reload';
  exec(`asterisk -rx "${cmd}"`, (err) => {
    if (err) console.error(`[ERROR] Reload failed: ${err.message}`);
    else console.log(`[ASTERISK] ${module || 'Core'} reloaded`);
  });
}

function generatePjsipUsers(extensions) {
  let conf = '';
  extensions.forEach(ext => {
    conf += `[${ext.id}]\n`;
    conf += `type=endpoint\n`;
    conf += `auth=${ext.id}\n`;
    conf += `aors=${ext.id}\n`;
    conf += `context=from-internal\n`;
    conf += `disallow=all\n`;
    conf += `allow=ulaw,alaw\n`;
    conf += `direct_media=no\n`;
    conf += `rewrite_contact=yes\n`;
    conf += `force_rport=yes\n`;
    conf += `rtp_symmetric=yes\n`;
    conf += `identify_by=username\n`;
    conf += `language=ru\n\n`;

    conf += `[${ext.id}]\n`;
    conf += `type=auth\n`;
    conf += `auth_type=userpass\n`;
    conf += `username=${ext.id}\n`;
    conf += `password=${ext.secret}\n\n`;

    conf += `[${ext.id}]\n`;
    conf += `type=aor\n`;
    conf += `max_contacts=1\n`;
    conf += `remove_existing=yes\n\n`;
  });
  return conf;
}

function generatePjsipTrunks(trunks) {
  let conf = '';
  trunks.forEach(t => {
    const trunkId = t.id || t.name.toLowerCase().replace(/\s+/g, '-');
    
    // Registration block (CRITICAL for Asterisk 17)
    conf += `[${trunkId}-reg]\n`;
    conf += `type=registration\n`;
    conf += `transport=transport-udp-nat\n`;
    conf += `outbound_auth=${trunkId}-auth\n`;
    conf += `server_uri=sip:${t.host}${t.port ? ':' + t.port : ''}\n`;
    conf += `client_uri=sip:${t.user}@${t.host}${t.port ? ':' + t.port : ''}\n`;
    conf += `retry_interval=60\n`;
    conf += `expiration=3600\n\n`;

    // Auth block
    conf += `[${trunkId}-auth]\n`;
    conf += `type=auth\n`;
    conf += `auth_type=userpass\n`;
    conf += `username=${t.user}\n`;
    conf += `password=${t.password}\n\n`;

    // AOR block
    conf += `[${trunkId}]\n`;
    conf += `type=aor\n`;
    conf += `contact=sip:${t.host}${t.port ? ':' + t.port : ''}\n\n`;

    // Endpoint block
    conf += `[${trunkId}]\n`;
    conf += `type=endpoint\n`;
    conf += `transport=transport-udp-nat\n`;
    conf += `context=from-trunk\n`;
    conf += `disallow=all\n`;
    conf += `allow=ulaw,alaw\n`;
    conf += `outbound_auth=${trunkId}-auth\n`;
    conf += `aors=${trunkId}\n`;
    conf += `direct_media=no\n\n`;
    
    // Identify block
    conf += `[${trunkId}-identify]\n`;
    conf += `type=identify\n`;
    conf += `endpoint=${trunkId}\n`;
    conf += `match=${t.host}\n\n`;
  });
  return conf;
}

function generateQueues(queues) {
  let conf = '';
  queues.forEach(q => {
    conf += `[${q.name}]\n`;
    conf += `strategy=${q.strategy || 'ringall'}\n`;
    conf += `timeout=15\n`;
    conf += `retry=5\n`;
    conf += `wrapuptime=0\n`;
    conf += `musicclass=${q.musicOnHoldClass || 'default'}\n`;
    (q.members || []).forEach(m => {
      conf += `member => PJSIP/${m}\n`;
    });
    conf += `\n`;
  });
  return conf;
}

function generateDialplan(extensions, routes, queues, ivrs) {
  let conf = `[general]\nstatic=yes\nwriteprotect=no\n\n`;
  
  // Внутренняя связь
  conf += `[from-internal]\n`;
  extensions.forEach(ext => {
    conf += `exten => ${ext.id},1,NoOp(Call to ${ext.id})\n`;
    conf += `same => n,Dial(PJSIP/${ext.id},30)\n`;
    conf += `same => n,Hangup()\n`;
  });

  // Очереди
  queues.forEach(q => {
    conf += `exten => ${q.name},1,Answer()\n`;
    conf += `same => n,Queue(${q.name})\n`;
    conf += `same => n,Hangup()\n`;
  });

  // Исходящие
  routes.filter(r => r.type === 'outbound').forEach(r => {
    const trunk = r.destination.split(':')[1];
    conf += `exten => ${r.pattern},1,NoOp(Outbound Call via ${trunk})\n`;
    conf += `same => n,Dial(PJSIP/\${EXTEN}@${trunk})\n`;
    conf += `same => n,Hangup()\n`;
  });

  // Входящие (DID)
  conf += `\n[from-trunk]\n`;
  routes.filter(r => r.type === 'inbound').forEach(r => {
    const dest = r.destination.split(':');
    const type = dest[0];
    const target = dest[1];

    conf += `exten => ${r.pattern},1,NoOp(Inbound DID ${r.pattern})\n`;
    if (type === 'Extension') conf += `same => n,Dial(PJSIP/${target},30)\n`;
    else if (type === 'Queue') conf += `same => n,Queue(${target})\n`;
    else if (type === 'IVR') conf += `same => n,Goto(ivr-${target},s,1)\n`;
    conf += `same => n,Hangup()\n`;
  });

  // IVR секции
  ivrs.forEach(ivr => {
    conf += `\n[ivr-${ivr.id}]\n`;
    conf += `exten => s,1,Answer()\n`;
    conf += `same => n,Background(${ivr.announcementFile})\n`;
    conf += `same => n,WaitExten(5)\n`;
    
    (ivr.digitMappings || []).forEach(m => {
      const [digit, type, target] = m.split(':');
      if (type === 'ext') conf += `exten => ${digit},1,Dial(PJSIP/${target},30)\n`;
      else if (type === 'queue') conf += `exten => ${digit},1,Queue(${target})\n`;
      else if (type === 'ivr') conf += `exten => ${digit},1,Goto(ivr-${target},s,1)\n`;
    });
    conf += `exten => t,1,Hangup()\n`;
    conf += `exten => i,1,Playback(invalid)\n`;
    conf += `same => n,Goto(s,1)\n`;
  });

  return conf;
}

function syncConfigs() {
  console.log('[BRIDGE] Синхронизация данных...');
  
  try {
    const extensions = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'extensions.json'), 'utf8') || '[]');
    const trunks = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'trunks.json'), 'utf8') || '[]');
    const routes = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'routes.json'), 'utf8') || '[]');
    const queues = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'queues.json'), 'utf8') || '[]');
    const ivrs = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'ivrs.json'), 'utf8') || '[]');

    fs.writeFileSync(path.join(AST_CONF_DIR, 'pjsip_miac_users.conf'), generatePjsipUsers(extensions));
    fs.writeFileSync(path.join(AST_CONF_DIR, 'pjsip_miac_trunks.conf'), generatePjsipTrunks(trunks));
    fs.writeFileSync(path.join(AST_CONF_DIR, 'queues_miac.conf'), generateQueues(queues));
    fs.writeFileSync(path.join(AST_CONF_DIR, 'extensions_miac_dialplan.conf'), generateDialplan(extensions, routes, queues, ivrs));

    reloadAsterisk('res_pjsip.so');
    reloadAsterisk('app_queue.so');
    reloadAsterisk('pbx_config.so');

  } catch (err) {
    console.error('[ERROR] Sync failed:', err.message);
  }
}

// Слежение за звуками
fs.watch(SOUNDS_DIR, (event, filename) => {
  if (!filename) return;
  console.log(`[SOUNDS] New file detected: ${filename}`);
  const src = path.join(SOUNDS_DIR, filename);
  const dst = path.join(AST_SOUNDS_DIR, filename);
  fs.copyFileSync(src, dst);
  exec(`chmod 666 ${dst}`);
});

// Слежение за JSON
[
  path.join(DATA_DIR, 'extensions.json'),
  path.join(DATA_DIR, 'trunks.json'),
  path.join(DATA_DIR, 'routes.json'),
  path.join(DATA_DIR, 'queues.json'),
  path.join(DATA_DIR, 'ivrs.json')
].forEach(file => {
  if (fs.existsSync(file)) {
    fs.watchFile(file, { interval: 1000 }, syncConfigs);
  }
});

console.log('🚀 [BRIDGE] Мост МИАЦ.СВЯЗЬ запущен и слушает изменения...');
syncConfigs();
