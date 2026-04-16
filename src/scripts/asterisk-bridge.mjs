
import fs from 'fs';
import path from 'path';
import asterisk from 'asterisk-manager';

// Конфигурация путей (AltLinux SP)
const DATA_DIR = '/etc/asterisk/miac.svyaz/src/data';
const AST_DIR = '/etc/asterisk';

const FILES = {
  exts: path.join(DATA_DIR, 'extensions.json'),
  trunks: path.join(DATA_DIR, 'trunks.json'),
  routes: path.join(DATA_DIR, 'routes.json'),
  confUsers: path.join(AST_DIR, 'pjsip_miac_users.conf'),
  confTrunks: path.join(AST_DIR, 'pjsip_miac_trunks.conf'),
  confDialplan: path.join(AST_DIR, 'extensions_miac_dialplan.conf')
};

// Настройки AMI
const amimanager = new asterisk(5038, '127.0.0.1', 'miac', 'MiacAMI2026', true);
amimanager.keepConnected();

console.log('🚀 [BRIDGE] Мост МИАЦ.СВЯЗЬ запущен (V2 - Full Configurator)');

function readJSON(file) {
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return [];
  }
}

function syncAll() {
  console.log('🔄 [BRIDGE] Синхронизация всех конфигураций...');
  
  const extensions = readJSON(FILES.exts);
  const trunks = readJSON(FILES.trunks);
  const routes = readJSON(FILES.routes);

  // 1. Генерация Абонентов
  let usersConf = '; Генерируемый файл пользователей МИАЦ.СВЯЗЬ\n\n';
  extensions.forEach(ext => {
    usersConf += `[${ext.id}]\ntype=endpoint\nauth=${ext.id}\naors=${ext.id}\ncontext=${ext.context || 'from-internal'}\ndisallow=all\nallow=alaw,ulaw\ntransport=transport-udp-nat\n\n`;
    usersConf += `[${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
    usersConf += `[${ext.id}]\ntype=aor\nmax_contacts=1\nremove_existing=yes\n\n`;
  });
  fs.writeFileSync(FILES.confUsers, usersConf);

  // 2. Генерация Транков
  let trunksConf = '; Генерируемый файл транков МИАЦ.СВЯЗЬ\n\n';
  trunks.forEach(t => {
    const trunkId = t.id || t.name;
    trunksConf += `[reg_${trunkId}]\ntype=registration\nserver_uri=sip:${t.host}:${t.port}\nclient_uri=sip:${t.user}@${t.host}:${t.port}\noutbound_auth=${trunkId}\nretry_interval=60\n\n`;
    trunksConf += `[${trunkId}]\ntype=auth\nauth_type=userpass\nusername=${t.user}\npassword=${t.password}\n\n`;
    trunksConf += `[${trunkId}]\ntype=aor\ncontact=sip:${t.host}:${t.port}\n\n`;
    trunksConf += `[${trunkId}]\ntype=endpoint\ncontext=from-trunk\ndisallow=all\nallow=alaw,ulaw\noutbound_auth=${trunkId}\naors=${trunkId}\ntransport=transport-udp-nat\n\n`;
    trunksConf += `[${trunkId}]\ntype=identify\nendpoint=${trunkId}\nmatch=${t.host}\n\n`;
  });
  fs.writeFileSync(FILES.confTrunks, trunksConf);

  // 3. Генерация Диалплана (Умный маршрутизатор)
  let dialplan = '; Генерируемый диалплан МИАЦ.СВЯЗЬ\n\n';
  
  // Внутренняя связь
  dialplan += '[from-internal]\n';
  dialplan += '; Звонки между абонентами\n';
  extensions.forEach(ext => {
    dialplan += `exten => ${ext.id},1,Dial(PJSIP/${ext.id},30)\n`;
    dialplan += `same => n,Hangup()\n`;
  });

  // Исходящая маршрутизация
  dialplan += '\n; Исходящие маршруты\n';
  routes.filter(r => r.type === 'outbound').forEach(route => {
    dialplan += `exten => _${route.pattern},1,NoOp(Outbound Call via ${route.destination})\n`;
    dialplan += `same => n,Dial(PJSIP/\${EXTEN}@${route.destination})\n`;
    dialplan += `same => n,Hangup()\n`;
  });

  // Входящая маршрутизация
  dialplan += '\n[from-trunk]\n';
  routes.filter(r => r.type === 'inbound').forEach(route => {
    // pattern для входящего - это DID
    dialplan += `exten => ${route.pattern},1,NoOp(Inbound Call for ${route.pattern})\n`;
    dialplan += `same => n,Dial(PJSIP/${route.destination.replace('Ext: ', '')})\n`;
    dialplan += `same => n,Hangup()\n`;
  });

  fs.writeFileSync(FILES.confDialplan, dialplan);

  console.log(`✅ [BRIDGE] Конфиги обновлены: ${extensions.length} аб., ${trunks.length} тр., ${routes.length} марш.`);
  
  // Перезагрузка Asterisk
  reloadAsterisk();
}

function reloadAsterisk() {
  const commands = ['module reload res_pjsip.so', 'dialplan reload'];
  commands.forEach(cmd => {
    amimanager.action({ action: 'Command', command: cmd }, (err, res) => {
      if (!err && res.response === 'Success') {
        console.log(`🔄 [BRIDGE] Asterisk Command (${cmd}): OK`);
      }
    });
  });
}

// Следим за изменениями файлов
[FILES.exts, FILES.trunks, FILES.routes].forEach(file => {
  fs.watch(file, (event) => {
    if (event === 'change') {
      setTimeout(syncAll, 500); // Небольшая задержка для записи
    }
  });
});

// Первичный запуск
syncAll();

// Обновление статусов
setInterval(() => {
  amimanager.action({ action: 'PJSIPShowEndpoints' }, (err, res) => {
    if (err) return;
    const extensions = readJSON(FILES.exts);
    let changed = false;

    // В реальности AMI вернет серию событий, но для MVP упростим:
    // Мы можем парсить статус из ответа Command "pjsip show endpoints"
  });
}, 5000);
