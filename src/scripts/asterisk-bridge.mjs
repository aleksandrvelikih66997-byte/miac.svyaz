
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

/**
 * @fileOverview Скрипт синхронизации (Мост).
 * Следит за локальной базой данных и обновляет конфиги Asterisk.
 * Совместим с Asterisk 17/20 (PJSIP).
 */

const EXTENSIONS_FILE = path.join(process.cwd(), 'src/data/extensions.json');
const TARGET_CONF = '/etc/asterisk/pjsip_miac_users.conf';

console.log('🚀 [BRIDGE] Мост МИАЦ.СВЯЗЬ запущен...');
console.log(`📂 [BRIDGE] Отслеживание базы: ${EXTENSIONS_FILE}`);
console.log(`📂 [BRIDGE] Целевой файл: ${TARGET_CONF}`);

// Функция генерации конфига PJSIP
function generatePjsipConfig(extensions) {
  let config = '; АВТОГЕНЕРАЦИЯ МИАЦ.СВЯЗЬ\n';
  config += `; Обновлено: ${new Date().toLocaleString()}\n\n`;

  extensions.forEach(ext => {
    const id = ext.id;
    const secret = ext.secret || 'password';
    const context = ext.context || 'from-internal';

    // 1. Endpoint
    config += `[${id}]\n`;
    config += `type=endpoint\n`;
    config += `context=${context}\n`;
    config += `disallow=all\n`;
    config += `allow=ulaw,alaw,g722\n`;
    config += `auth=${id}\n`;
    config += `aors=${id}\n`;
    config += `callerid=${ext.name} <${id}>\n`;
    config += `dtmf_mode=rfc4733\n`;
    config += `direct_media=no\n\n`;

    // 2. Auth
    config += `[${id}]\n`;
    config += `type=auth\n`;
    config += `auth_type=userpass\n`;
    config += `password=${secret}\n`;
    config += `username=${id}\n\n`;

    // 3. AOR
    config += `[${id}]\n`;
    config += `type=aor\n`;
    config += `max_contacts=1\n`;
    config += `remove_existing=yes\n\n`;
  });

  return config;
}

// Функция синхронизации
function sync() {
  if (!fs.existsSync(EXTENSIONS_FILE)) return;

  try {
    const data = JSON.parse(fs.readFileSync(EXTENSIONS_FILE, 'utf8'));
    const config = generatePjsipConfig(data);

    fs.writeFileSync(TARGET_CONF, config);
    console.log(`✅ [BRIDGE] Файл ${TARGET_CONF} обновлен. Абонентов: ${data.length}`);

    // Перезагрузка PJSIP в Asterisk
    exec('asterisk -rx "pjsip reload"', (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ [BRIDGE] Ошибка перезагрузки Asterisk: ${error.message}`);
        return;
      }
      console.log(`🔄 [BRIDGE] Asterisk PJSIP Reload: OK`);
    });
  } catch (err) {
    console.error(`❌ [BRIDGE] Ошибка при обработке данных: ${err.message}`);
  }
}

// Первоначальный запуск
sync();

// Следим за изменениями в JSON файле
fs.watch(EXTENSIONS_FILE, (eventType) => {
  if (eventType === 'change') {
    console.log('📝 [BRIDGE] Обнаружены изменения в базе абонентов...');
    // Небольшая задержка, чтобы файл успел полностью записаться
    setTimeout(sync, 100);
  }
});
