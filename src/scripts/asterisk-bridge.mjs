
/**
 * @fileOverview Мост синхронизации между Firestore и локальными конфигами Asterisk.
 * Слушает изменения в коллекции 'extensions' и обновляет pjsip_miac_users.conf.
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, query } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import ami from 'asterisk-manager';

// Конфиг Firebase (локальные заглушки для закрытого контура, если нет реальных)
const firebaseConfig = {
  apiKey: "api-key",
  authDomain: "project-id.firebaseapp.com",
  projectId: "project-id",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const PJSIP_FILE = '/etc/asterisk/pjsip_miac_users.conf';
const AMI_PORT = 5038;
const AMI_HOST = '127.0.0.1';
const AMI_USER = 'miac';
const AMI_PASS = 'MiacAMI2026';

// Подключение к AMI для перезагрузки конфигов
const manager = new ami(AMI_PORT, AMI_HOST, AMI_USER, AMI_PASS, true);

manager.on('error', (err) => {
  console.error('[AMI ERROR]', err.message);
});

function reloadAsterisk() {
  manager.action({
    action: 'Command',
    command: 'pjsip reload'
  }, (err, res) => {
    if (err) console.error('[RELOAD ERROR]', err);
    else console.log('[ASTERISK] Config reloaded successfully');
  });
}

console.log('[BRIDGE] Запуск мониторинга абонентов...');

// Слушаем изменения в Firestore
const q = query(collection(db, "extensions"));
onSnapshot(q, (snapshot) => {
  let configContent = '; --- Генерируемый файл МИАЦ.СВЯЗЬ ---\n; Не редактируйте вручную!\n\n';

  snapshot.forEach((doc) => {
    const ext = doc.data();
    const id = doc.id;

    configContent += `[${id}]\ntype=endpoint\ncontext=${ext.context || 'from-internal'}\ndisallow=all\nallow=ulaw,alaw\nauth=auth${id}\naors=${id}\n\n`;
    configContent += `[auth${id}]\ntype=auth\nauth_type=userpass\nusername=${id}\npassword=${ext.secret}\n\n`;
    configContent += `[${id}]\ntype=aor\nmax_contacts=1\n\n`;
  });

  try {
    fs.writeFileSync(PJSIP_FILE, configContent);
    console.log(`[BRIDGE] Файл ${PJSIP_FILE} обновлен. Абонентов: ${snapshot.size}`);
    reloadAsterisk();
  } catch (err) {
    console.error('[FILE ERROR] Ошибка записи конфига:', err.message);
    console.log('Подсказка: Выполните chmod 666 ' + PJSIP_FILE);
  }
});
