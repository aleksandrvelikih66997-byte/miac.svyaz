
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Пути
const PROJECT_ROOT = path.join(__dirname, '../..');
const DATA_DIR = path.join(PROJECT_ROOT, 'src/data');
const SOUNDS_DIR = path.join(DATA_DIR, 'sounds');
const ASTERISK_CONF_DIR = '/etc/asterisk';
const ASTERISK_SOUNDS_DIR = '/var/lib/asterisk/sounds';

// Файлы данных
const FILES = {
  extensions: path.join(DATA_DIR, 'extensions.json'),
  trunks: path.join(DATA_DIR, 'trunks.json'),
  routes: path.join(DATA_DIR, 'routes.json'),
  queues: path.join(DATA_DIR, 'queues.json'),
  ivrs: path.join(DATA_DIR, 'ivrs.json'),
};

// Целевые конфиги Asterisk
const TARGETS = {
  users: path.join(ASTERISK_CONF_DIR, 'pjsip_miac_users.conf'),
  trunks: path.join(ASTERISK_CONF_DIR, 'pjsip_miac_trunks.conf'),
  queues: path.join(ASTERISK_CONF_DIR, 'queues_miac.conf'),
  dialplan: path.join(ASTERISK_CONF_DIR, 'extensions_miac_dialplan.conf'),
};

// ГАРАНТИЯ СУЩЕСТВОВАНИЯ ДИРЕКТОРИЙ (Исправление ошибки ENOENT)
[DATA_DIR, SOUNDS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📂 [BRIDGE] Создана директория: ${dir}`);
  }
});

function runCommand(cmd) {
  return new Promise((resolve) => {
    exec(`asterisk -rx "${cmd}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ [BRIDGE] Ошибка команды: ${cmd}`, stderr);
        resolve(false);
      } else {
        console.log(`🔄 [BRIDGE] Asterisk CLI (${cmd}): OK`);
        resolve(true);
      }
    });
  });
}

async function syncAll() {
  console.log('🔄 [BRIDGE] Начало синхронизации конфигурации...');
  
  try {
    const extensions = JSON.parse(fs.readFileSync(FILES.extensions, 'utf8') || '[]');
    const trunks = JSON.parse(fs.readFileSync(FILES.trunks, 'utf8') || '[]');
    const routes = JSON.parse(fs.readFileSync(FILES.routes, 'utf8') || '[]');
    const queues = JSON.parse(fs.readFileSync(FILES.queues, 'utf8') || '[]');
    const ivrs = JSON.parse(fs.readFileSync(FILES.ivrs, 'utf8') || '[]');

    // 1. Синхронизация абонентов
    let usersConf = '; Генерируемый файл абонентов МИАЦ\n\n';
    extensions.forEach(ext => {
      usersConf += `[${ext.id}]\ntype=endpoint\ncontext=from-internal\ndisallow=all\nallow=ulaw,alaw\nauth=${ext.id}\naors=${ext.id}\ndirect_media=no\n\n`;
      usersConf += `[${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
      usersConf += `[${ext.id}]\ntype=aor\nmax_contacts=1\n\n`;
    });
    fs.writeFileSync(TARGETS.users, usersConf);

    // 2. Синхронизация транков
    let trunksConf = '; Генерируемый файл транков МИАЦ\n\n';
    trunks.forEach(t => {
      trunksConf += `[${t.id}-reg]\ntype=registration\noutbound_auth=${t.id}-auth\nserver_uri=sip:${t.host}:${t.port || 5060}\nclient_uri=sip:${t.user}@${t.host}:${t.port || 5060}\n\n`;
      trunksConf += `[${t.id}-auth]\ntype=auth\nauth_type=userpass\nusername=${t.user}\npassword=${t.password}\n\n`;
      trunksConf += `[${t.id}-aor]\ntype=aor\ncontact=sip:${t.host}:${t.port || 5060}\n\n`;
      trunksConf += `[${t.id}]\ntype=endpoint\ncontext=from-trunk\ndisallow=all\nallow=ulaw,alaw\noutbound_auth=${t.id}-auth\naors=${t.id}-aor\n\n`;
      trunksConf += `[${t.id}-identify]\ntype=identify\nendpoint=${t.id}\nmatch=${t.host}\n\n`;
    });
    fs.writeFileSync(TARGETS.trunks, trunksConf);

    // 3. Синхронизация очередей
    let qConf = '; Генерируемый файл очередей МИАЦ\n\n';
    queues.forEach(q => {
      qConf += `[${q.name}]\nstrategy=${q.strategy || 'ringall'}\nmusiconhold=${q.musicOnHoldClass || 'default'}\n`;
      (q.members || []).forEach(m => {
        qConf += `member => PJSIP/${m}\n`;
      });
      qConf += `\n`;
    });
    fs.writeFileSync(TARGETS.queues, qConf);

    // 4. Синхронизация диалплана
    let dialplanConf = '; Генерируемый диалплан МИАЦ\n\n[from-internal]\n';
    // Внутренние звонки
    extensions.forEach(ext => {
      dialplanConf += `exten => ${ext.id},1,Dial(PJSIP/${ext.id},30)\n`;
      dialplanConf += `same => n,Hangup()\n`;
    });

    // Логика IVR
    ivrs.forEach(ivr => {
      dialplanConf += `[ivr-${ivr.id}]\n`;
      dialplanConf += `exten => s,1,Answer()\n`;
      dialplanConf += `same => n,Background(${ivr.announcementFile})\n`;
      dialplanConf += `same => n,WaitExten(5)\n`;
      (ivr.digitMappings || []).forEach(m => {
        const parts = m.split(':');
        if (parts.length === 3) {
          const [digit, type, target] = parts;
          if (type === 'ext') dialplanConf += `exten => ${digit},1,Goto(from-internal,${target},1)\n`;
          else if (type === 'queue') dialplanConf += `exten => ${digit},1,Queue(${target})\n`;
          else if (type === 'ivr') dialplanConf += `exten => ${digit},1,Goto(ivr-${target},s,1)\n`;
        }
      });
    });

    // Исходящие маршруты
    routes.filter(r => r.type === 'outbound').forEach(r => {
      const parts = r.destination.split(':');
      if (parts.length === 2) {
        const trunkId = parts[1];
        dialplanConf += `exten => ${r.pattern},1,Dial(PJSIP/\${EXTEN}@${trunkId})\n`;
      }
    });

    // Входящие маршруты
    dialplanConf += `\n[from-trunk]\n`;
    routes.filter(r => r.type === 'inbound').forEach(r => {
      const parts = r.destination.split(':');
      if (parts.length === 2) {
        const [type, target] = parts;
        if (type === 'Extension') dialplanConf += `exten => ${r.pattern},1,Dial(PJSIP/${target},30)\n`;
        else if (type === 'Queue') dialplanConf += `exten => ${r.pattern},1,Queue(${target})\n`;
        else if (type === 'IVR') dialplanConf += `exten => ${r.pattern},1,Goto(ivr-${target},s,1)\n`;
      }
    });

    fs.writeFileSync(TARGETS.dialplan, dialplanConf);

    // Перезагрузка модулей
    await runCommand('module reload res_pjsip.so');
    await runCommand('module reload app_queue.so');
    await runCommand('dialplan reload');

    // Синхронизация звуков
    if (fs.existsSync(SOUNDS_DIR)) {
      const files = fs.readdirSync(SOUNDS_DIR);
      files.forEach(file => {
        const src = path.join(SOUNDS_DIR, file);
        const dest = path.join(ASTERISK_SOUNDS_DIR, file);
        if (!fs.existsSync(dest)) {
          try {
            fs.copyFileSync(src, dest);
            fs.chmodSync(dest, 0o666);
            console.log(`🎵 [BRIDGE] Скопирован звук: ${file}`);
          } catch (e) {
            console.error(`⚠️ [BRIDGE] Ошибка копирования звука ${file}:`, e.message);
          }
        }
      });
    }

    console.log('✅ [BRIDGE] Синхронизация завершена успешно.');
  } catch (error) {
    console.error('❌ [BRIDGE] Ошибка синхронизации:', error);
  }
}

// Наблюдение за изменениями JSON файлов
Object.values(FILES).forEach(file => {
  if (fs.existsSync(file)) {
    fs.watch(file, (eventType) => {
      if (eventType === 'change') {
        syncAll();
      }
    });
  }
});

// Наблюдение за звуками
fs.watch(SOUNDS_DIR, (eventType) => {
  if (eventType === 'rename') syncAll();
});

// Первый запуск
syncAll();

console.log('🚀 [BRIDGE] Мост МИАЦ.СВЯЗЬ запущен и ожидает изменений...');
