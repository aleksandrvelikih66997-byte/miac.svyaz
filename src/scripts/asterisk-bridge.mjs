
import fs from 'fs';
import path from 'path';
import asteriskManager from 'asterisk-manager';

// Конфигурация путей (AltLinux / Asterisk 17)
const DATA_DIR = path.join(process.cwd(), 'src/data');
const PJSIP_CONF = '/etc/asterisk/pjsip_miac_users.conf';
const DIALPLAN_CONF = '/etc/asterisk/extensions_miac_dialplan.conf';

console.log('🚀 [BRIDGE] Мост МИАЦ.СВЯЗЬ запущен...');
console.log(`📂 [BRIDGE] Директория данных: ${DATA_DIR}`);

// Настройка AMI (Manager)
const ami = new asteriskManager(5038, '127.0.0.1', 'miac', 'MiacAMI2026', true);

function syncTelephony() {
  console.log('🔄 [BRIDGE] Начало синхронизации...');
  
  const extensionsFile = path.join(DATA_DIR, 'extensions.json');
  if (!fs.existsSync(extensionsFile)) {
    console.log('⚠️ [BRIDGE] Файл абонентов не найден.');
    return;
  }

  try {
    const extensions = JSON.parse(fs.readFileSync(extensionsFile, 'utf8'));
    
    // 1. Генерируем PJSIP конфигурацию
    let pjsipContent = '; ГЕНЕРИРУЕМЫЙ ФАЙЛ МИАЦ.СВЯЗЬ - НЕ РЕДАКТИРОВАТЬ ВРУЧНУЮ\n\n';
    
    extensions.forEach(ext => {
      console.log(`📡 [BRIDGE] Обработка абонента: ${ext.id}`);
      
      // Секция эндпоинта
      pjsipContent += `[${ext.id}]\ntype=endpoint\ncontext=from-internal\ndisallow=all\nallow=ulaw,alaw\nauth=${ext.id}\naors=${ext.id}\ntransport=transport-udp-nat\ndirect_media=no\n\n`;
      
      // Секция аутентификации
      pjsipContent += `[${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
      
      // Секция AOR (регистрации)
      pjsipContent += `[${ext.id}]\ntype=aor\nmax_contacts=1\nremove_existing=yes\n\n`;
    });

    fs.writeFileSync(PJSIP_CONF, pjsipContent);
    console.log(`✅ [BRIDGE] PJSIP конфиг обновлен. Абонентов: ${extensions.length}`);

    // 2. Генерируем Dialplan (Маршрутизация внутри МИАЦ)
    let dialplanContent = '; ГЕНЕРИРУЕМЫЙ ДИАЛПЛАН МИАЦ.СВЯЗЬ\n\n[from-internal]\n';
    dialplanContent += 'exten => _XXX,1,NoOp(Внутренний вызов на ${EXTEN})\n';
    dialplanContent += ' same => n,Dial(PJSIP/${EXTEN},30)\n';
    dialplanContent += ' same => n,Hangup()\n';

    fs.writeFileSync(DIALPLAN_CONF, dialplanContent);
    console.log(`✅ [BRIDGE] Dialplan обновлен.`);

    // 3. Применяем настройки через AMI
    ami.action({
      action: 'Command',
      command: 'module reload res_pjsip.so'
    }, (err, res) => {
      if (err) console.error('❌ [BRIDGE] AMI Reload PJSIP Error:', err);
      else console.log('🔄 [BRIDGE] Asterisk PJSIP Reload: OK');
    });

    ami.action({
      action: 'Command',
      command: 'dialplan reload'
    }, (err, res) => {
      if (err) console.error('❌ [BRIDGE] AMI Reload Dialplan Error:', err);
      else console.log('🔄 [BRIDGE] Asterisk Dialplan Reload: OK');
    });

  } catch (e) {
    console.error('❌ [BRIDGE] Ошибка синхронизации:', e);
  }
}

// Периодическое обновление статусов (Online/Offline)
function updateStatuses() {
  ami.action({
    action: 'Command',
    command: 'pjsip show endpoints'
  }, (err, res) => {
    if (err || !res.output) return;
    
    const output = Array.isArray(res.output) ? res.output.join('\n') : res.output;
    const extensionsFile = path.join(DATA_DIR, 'extensions.json');
    if (!fs.existsSync(extensionsFile)) return;

    try {
      let extensions = JSON.parse(fs.readFileSync(extensionsFile, 'utf8'));
      let changed = false;

      extensions = extensions.map(ext => {
        // Ищем строку статуса для эндпоинта
        const regex = new RegExp(`${ext.id}\/${ext.id}\\s+([\\w\\s]+)\\s+\\d+ of`, 'i');
        const match = output.match(regex);
        let newStatus = 'offline';
        
        if (match) {
          const state = match[1].trim().toLowerCase();
          if (state.includes('not in use') || state.includes('reachable')) newStatus = 'online';
          if (state.includes('busy') || state.includes('in use')) newStatus = 'busy';
        }

        if (ext.status !== newStatus) {
          ext.status = newStatus;
          changed = true;
        }
        return ext;
      });

      if (changed) {
        fs.writeFileSync(extensionsFile, JSON.stringify(extensions, null, 2));
        console.log('📊 [BRIDGE] Статусы абонентов обновлены.');
      }
    } catch (e) {
      console.error('❌ [BRIDGE] Status update error:', e);
    }
  });
}

// Следим за изменениями в JSON базе
fs.watch(DATA_DIR, (eventType, filename) => {
  if (filename && filename.endsWith('.json')) {
    console.log(`📝 [BRIDGE] Изменение в ${filename}, синхронизируем...`);
    syncTelephony();
  }
});

// Запуск интервалов
setInterval(updateStatuses, 5000);
syncTelephony();

ami.on('error', (err) => console.log('❌ [BRIDGE] AMI Connection Error:', err.message));
ami.on('close', () => console.log('⚠️ [BRIDGE] AMI Connection Closed'));
