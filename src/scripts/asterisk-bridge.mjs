
import fs from 'fs';
import path from 'path';
import asteriskManager from 'asterisk-manager';

// Конфигурация путей (адаптируйте под вашу систему)
const DATA_DIR = path.resolve('src/data');
const SOUNDS_DIR = path.resolve('src/data/sounds');
const ASTERISK_CONF_DIR = '/etc/asterisk';

const FILES = {
  extensions: path.join(DATA_DIR, 'extensions.json'),
  trunks: path.join(DATA_DIR, 'trunks.json'),
  routes: path.join(DATA_DIR, 'routes.json'),
  queues: path.join(DATA_DIR, 'queues.json'),
  ivrs: path.join(DATA_DIR, 'ivrs.json'),
};

const TARGETS = {
  pjsip_users: path.join(ASTERISK_CONF_DIR, 'pjsip_miac_users.conf'),
  pjsip_trunks: path.join(ASTERISK_CONF_DIR, 'pjsip_miac_trunks.conf'),
  queues: path.join(ASTERISK_CONF_DIR, 'queues_miac.conf'),
  dialplan: path.join(ASTERISK_CONF_DIR, 'extensions_miac_dialplan.conf'),
};

// Создание необходимых директорий
[DATA_DIR, SOUNDS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`[SYSTEM] Создана директория: ${dir}`);
  }
});

// Настройка AMI
const ami = new asteriskManager(5038, '127.0.0.1', 'miac', 'MiacAMI2026', true);
ami.keepConnected();

function reloadAsterisk(module = 'all') {
  const commands = {
    pjsip: 'pjsip reload',
    dialplan: 'dialplan reload',
    queues: 'queue reload all',
    all: 'core reload'
  };
  
  const cmd = commands[module] || commands.all;
  ami.action({ action: 'Command', command: cmd }, (err, res) => {
    if (err) console.error(`[AMI ERROR] Ошибка перезагрузки ${module}:`, err);
    else console.log(`[AMI] Конфигурация ${module} успешно обновлена в Asterisk.`);
  });
}

function generateConfigs() {
  console.log('[BRIDGE] Генерация конфигурационных файлов Asterisk...');

  // 1. Абоненты (PJSIP Users)
  const extensions = JSON.parse(fs.readFileSync(FILES.extensions, 'utf8') || '[]');
  let pjsipContent = '; Генерируемый файл пользователей МИАЦ.СВЯЗЬ\n\n';
  
  extensions.forEach(ext => {
    pjsipContent += `[${ext.id}]\ntype=endpoint\ncontext=${ext.context || 'from-internal'}\ndisallow=all\nallow=ulaw,alaw\nauth=${ext.id}\naors=${ext.id}\nidentify_by=auth_username,username\nrtp_symmetric=yes\nrewrite_contact=yes\ndirect_media=no\nlanguage=ru\n\n`;
    pjsipContent += `[${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
    pjsipContent += `[${ext.id}]\ntype=aor\nmax_contacts=5\nremove_existing=yes\n\n`;
  });
  fs.writeFileSync(TARGETS.pjsip_users, pjsipContent);

  // 2. Транки (PJSIP Trunks)
  const trunks = JSON.parse(fs.readFileSync(FILES.trunks, 'utf8') || '[]');
  let trunksContent = '; Генерируемый файл транков МИАЦ.СВЯЗЬ\n\n';
  
  trunks.forEach(t => {
    const trunkId = t.id || t.name.toLowerCase().replace(/\s+/g, '-');
    trunksContent += `[${trunkId}]\ntype=registration\noutbound_auth=${trunkId}\nserver_uri=sip:${t.host}:${t.port || 5060}\nclient_uri=sip:${t.user}@${t.host}:${t.port || 5060}\nretry_interval=60\n\n`;
    trunksContent += `[${trunkId}]\ntype=auth\nauth_type=userpass\nusername=${t.user}\npassword=${t.password}\n\n`;
    trunksContent += `[${trunkId}]\ntype=aor\ncontact=sip:${t.host}:${t.port || 5060}\n\n`;
    trunksContent += `[${trunkId}]\ntype=endpoint\ncontext=from-trunk\ndisallow=all\nallow=ulaw,alaw\noutbound_auth=${trunkId}\naors=${trunkId}\nfrom_user=${t.user}\nfrom_domain=${t.host}\nrtp_symmetric=yes\nrewrite_contact=yes\n\n`;
    trunksContent += `[${trunkId}]\ntype=identify\nendpoint=${trunkId}\nmatch=${t.host}\n\n`;
  });
  fs.writeFileSync(TARGETS.pjsip_trunks, trunksContent);

  // 3. Очереди (Queues)
  const queues = JSON.parse(fs.readFileSync(FILES.queues, 'utf8') || '[]');
  let queuesContent = '; Генерируемый файл очередей МИАЦ.СВЯЗЬ\n\n';
  
  queues.forEach(q => {
    queuesContent += `[${q.name}]\ntype=queue\nstrategy=${q.strategy || 'ringall'}\nmusiconhold=${q.musicOnHoldClass || 'default'}\n`;
    (q.members || []).forEach(m => {
      queuesContent += `member=PJSIP/${m}\n`;
    });
    queuesContent += `\n`;
  });
  fs.writeFileSync(TARGETS.queues, queuesContent);

  // 4. Диалплан (Extensions)
  const routes = JSON.parse(fs.readFileSync(FILES.routes, 'utf8') || '[]');
  const ivrs = JSON.parse(fs.readFileSync(FILES.ivrs, 'utf8') || '[]');
  let dialplanContent = '[from-internal]\n';
  dialplanContent += 'exten => _XXX,1,Dial(PJSIP/${EXTEN},30)\n';
  dialplanContent += 'same => n,Hangup()\n\n';

  // Исходящая маршрутизация
  routes.filter(r => r.type === 'outbound').forEach(r => {
    const trunkId = r.destination.split(':')[1];
    dialplanContent += `exten => ${r.pattern},1,Dial(PJSIP/\${EXTEN}@${trunkId})\n`;
  });

  // Входящая маршрутизация
  dialplanContent += '\n[from-trunk]\n';
  routes.filter(r => r.type === 'inbound').forEach(r => {
    const [type, id] = r.destination.split(':');
    if (type === 'Extension') dialplanContent += `exten => ${r.pattern},1,Dial(PJSIP/${id},30)\n`;
    if (type === 'Queue') dialplanContent += `exten => ${r.pattern},1,Queue(${id})\n`;
    if (type === 'IVR') dialplanContent += `exten => ${r.pattern},1,Goto(ivr-${id},s,1)\n`;
  });

  // IVR Диалплан
  ivrs.forEach(ivr => {
    dialplanContent += `\n[ivr-${ivr.id}]\nexten => s,1,Answer()\nsame => n,Set(TIMEOUT(digit)=5)\nsame => n,Background(${ivr.announcementFile})\nsame => n,WaitExten(10)\n\n`;
    (ivr.digitMappings || []).forEach(m => {
      const [digit, type, target] = m.split(':');
      if (type === 'ext') dialplanContent += `exten => ${digit},1,Dial(PJSIP/${target},30)\n`;
      if (type === 'queue') dialplanContent += `exten => ${digit},1,Queue(${target})\n`;
      if (type === 'ivr') dialplanContent += `exten => ${digit},1,Goto(ivr-${target},s,1)\n`;
    });
  });

  fs.writeFileSync(TARGETS.dialplan, dialplanContent);
  
  reloadAsterisk('all');
}

// Слежение за изменениями
console.log('🚀 [BRIDGE] Мост МИАЦ.СВЯЗЬ запущен...');
Object.values(FILES).forEach(file => {
  if (fs.existsSync(file)) {
    fs.watchFile(file, (curr, prev) => {
      console.log(`[SYSTEM] Изменение в ${path.basename(file)}`);
      generateConfigs();
    });
  }
});

// Синхронизация звуков
fs.watch(SOUNDS_DIR, (eventType, filename) => {
  if (filename && eventType === 'rename') {
    const src = path.join(SOUNDS_DIR, filename);
    const dest = path.join('/var/lib/asterisk/sounds', filename);
    if (fs.existsSync(src)) {
      try {
        fs.copyFileSync(src, dest);
        fs.chmodSync(dest, 0o666);
        console.log(`[SOUNDS] Файл ${filename} синхронизирован с Asterisk.`);
      } catch (e) {
        console.error(`[SOUNDS ERROR] Не удалось скопировать ${filename}:`, e.message);
      }
    }
  }
});

// Первый запуск
generateConfigs();
