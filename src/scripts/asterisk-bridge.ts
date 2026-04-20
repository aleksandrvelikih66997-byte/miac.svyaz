
import { rebuildAsteriskConfig } from '../lib/asterisk-bridge-logic';

/**
 * Скрипт ручной синхронизации данных из JSON в файлы Asterisk.
 * Используется, когда у веб-сервера нет прав записи в /etc/asterisk.
 */
async function main() {
  console.log('[BRIDGE] Запуск ручной синхронизации...');
  try {
    const result = rebuildAsteriskConfig();
    if (result) {
      console.log('[BRIDGE] Синхронизация завершена успешно.');
    } else {
      console.error('[BRIDGE] Ошибка при сборке конфигурации.');
    }
  } catch (error) {
    console.error('[BRIDGE] Критическая ошибка:', error);
    process.exit(1);
  }
}

main();
