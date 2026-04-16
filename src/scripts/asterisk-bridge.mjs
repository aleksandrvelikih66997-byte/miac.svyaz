
/**
 * МИАЦ.СВЯЗЬ - МОСТ СИНХРОНИЗАЦИИ (ЛОКАЛЬНЫЙ)
 * Работает в закрытом контуре. Читает JSON и пишет в Asterisk.
 */
import fs from 'fs';
import path from 'path';
import asteriskManager from 'asterisk-manager';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSIONS_FILE = path.join(__dirname, '../data/extensions.json');
const TARGET_CONF = '/etc/asterisk/pjsip_miac_users.conf';

// Настройки AMI
const ami = asteriskManager(5038, '127.0.0.1', 'miac', 'MiacAMI2026', true);

function syncToAsterisk() {
  console.log('🔄 [BRIDGE] Синхронизация данных с Asterisk...');

  if (!fs.existsSync(EXTENSIONS_FILE)) {
    console.log('⚠️ [BRIDGE] Файл данных не найден. Пропуск.');
    return;
  }

  try {
    const extensions = JSON.parse(fs.readFileSync(EXTENSIONS_FILE, 'utf8'));
    let configContent = '; ГЕНЕРИРУЕМЫЙ ФАЙЛ МИАЦ.СВЯЗЬ. НЕ РЕДАКТИРОВАТЬ ВРУЧНУЮ.\n\n';

    extensions.forEach(ext => {
      configContent += `[${ext.id}]\ntype=endpoint\nauth=auth${ext.id}\naors=${ext.id}\ncontext=${ext.context || 'from-internal'}\ndisallow=all\nallow=ulaw,alaw\n\n`;
      configContent += `[auth${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
      configContent += `[${ext.id}]\ntype=aor\nmax_contacts=1\n\n`;
    });

    fs.writeFileSync(TARGET_CONF, configContent);
    console.log(`✅ [BRIDGE] Обновлено: ${extensions.length} абонентов.`);

    // Команда на перезагрузку Asterisk через AMI
    ami.action({
      action: 'Command',
      command: 'pjsip reload'
    }, (err, res) => {
      if (err) console.error('❌ [AMI ERROR]', err);
      else console.log('🔄 [BRIDGE] Asterisk PJSIP Reload: OK');
    });

  } catch (error) {
    console.error('❌ [BRIDGE ERROR]', error);
  }
}

// Следим за изменениями в файле JSON
fs.watchFile(EXTENSIONS_FILE, (curr, prev) => {
  console.log('📝 [BRIDGE] Обнаружено изменение в базе данных...');
  syncToAsterisk();
});

console.log('🚀 [BRIDGE] Локальный мост МИАЦ.СВЯЗЬ запущен...');
syncToAsterisk(); // Начальная синхронизация
