
import { rebuildAsteriskConfig } from '../lib/asterisk-bridge-logic';
import { updateExtensionStatuses, getExtensions } from '../lib/telephony-store';
// @ts-ignore
import Ami from 'asterisk-manager';

/**
 * Скрипт "Моста" между Веб-панелью и Asterisk.
 * 1. Генерирует конфигурационные файлы из JSON.
 * 2. Подключается по AMI для отслеживания статусов "Онлайн".
 */
async function main() {
  console.log('[BRIDGE] Инициализация конфигурации...');
  try {
    rebuildAsteriskConfig();
    console.log('[BRIDGE] Конфигурационные файлы обновлены.');
  } catch (error) {
    console.error('[BRIDGE] Ошибка при сборке конфигурации:', error);
  }

  console.log('[BRIDGE] Подключение к Asterisk AMI (127.0.0.1:5038)...');
  
  // Данные для входа из вашего manager.conf
  const ami = new Ami(5038, '127.0.0.1', 'miac', 'MiacAMI2026', true);

  ami.keepConnected();

  // Функция для обновления статусов абонентов
  const refreshStatuses = async () => {
    ami.action({ action: 'Command', command: 'pjsip show endpoints' }, async (err: any, res: any) => {
      if (err || !res.output) {
        // Если AMI Command не сработал, пробуем через PJSIPShowEndpoints
        ami.action({ action: 'PJSIPShowEndpoints' }, (err2: any, res2: any) => {
          // Fallback logic could be here, but Command is more reliable for parsing text
        });
        return;
      }
      
      const output = Array.isArray(res.output) ? res.output.join('\n') : res.output;
      const extensions = await getExtensions();
      const newStatuses: Record<string, 'online' | 'offline'> = {};

      extensions.forEach((ext: any) => {
        // Ищем блок эндпоинта в выводе CLI
        const regex = new RegExp(`Endpoint:\\s+${ext.id}\\s+([^\\n]+)`, 'i');
        const match = output.match(regex);
        
        if (match) {
          const statusLine = match[1].toLowerCase();
          // В Asterisk 17+ статус "Not in use" или наличие контактов означает онлайн
          // Если статус "Unavailable" или "Unknown" - оффлайн
          if (statusLine.includes('unavailable') || statusLine.includes('unknown')) {
            newStatuses[ext.id] = 'offline';
          } else {
            newStatuses[ext.id] = 'online';
          }
        } else {
          newStatuses[ext.id] = 'offline';
        }
      });

      await updateExtensionStatuses(newStatuses);
    });
  };

  // Слушаем события Asterisk
  ami.on('managerevent', (evt: any) => {
    // Если кто-то зарегистрировался или отключился
    if (evt.event === 'ContactStatus' || evt.event === 'PeerStatus' || evt.event === 'DeviceStateChange') {
      refreshStatuses();
    }
  });

  ami.on('connect', () => {
    console.log('[AMI] Соединение установлено.');
    refreshStatuses();
  });

  ami.on('error', (err: any) => {
    console.error('[AMI] Ошибка:', err.message);
  });

  // Периодическое обновление статусов (на всякий случай)
  setInterval(refreshStatuses, 10000);

  console.log('[BRIDGE] Мост запущен и работает в фоновом режиме.');
}

main().catch(console.error);
