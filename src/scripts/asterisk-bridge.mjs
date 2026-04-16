
/**
 * @fileOverview Автоматический мост между Firestore и Asterisk PJSIP.
 * Работает на сервере AltLinux, синхронизирует конфиги и статусы.
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { firebaseConfig } from '../firebase/config.js';
import ami from 'asterisk-manager';
import { writeFileSync } from 'fs';
import { exec } from 'child_process';

// Инициализация клиента Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log('[BRIDGE] Инициализация моста МИАЦ.СВЯЗЬ...');

// 1. Синхронизация: WEB -> Asterisk (Конфигурация)
onSnapshot(collection(db, 'extensions'), (snapshot) => {
  let config = '; АВТОГЕНЕРАЦИЯ МИАЦ.СВЯЗЬ - НЕ РЕДАКТИРОВАТЬ ВРУЧНУЮ\n\n';
  
  snapshot.forEach((d) => {
    const ext = d.data();
    // Эндпоинт
    config += `[${ext.id}]\ntype=endpoint\nauth=auth${ext.id}\naors=${ext.id}\ncontext=${ext.context || 'from-internal'}\ndisallow=all\nallow=ulaw,alaw,g722\ntransport=transport-udp\n\n`;
    // Авторизация
    config += `[auth${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
    // AOR (Address of Record)
    config += `[${ext.id}]\ntype=aor\nmax_contacts=1\n\n`;
  });

  try {
    writeFileSync('/etc/asterisk/pjsip_miac_users.conf', config);
    exec('asterisk -rx "core reload"', (err) => {
      if (err) console.error('[BRIDGE] Ошибка перезагрузки Asterisk:', err);
      else console.log('[BRIDGE] Конфигурация PJSIP обновлена и применена');
    });
  } catch (e) {
    console.error('[BRIDGE] Ошибка записи файла:', e.message);
  }
});

// 2. Синхронизация: Asterisk -> WEB (Статусы через AMI)
const manager = new ami(5038, 'localhost', 'miac', 'MiacAMI2026', true);
manager.keepConnected();

manager.on('peerstatus', (evt) => {
  if (evt.peer.startsWith('PJSIP/')) {
    const extId = evt.peer.split('/')[1];
    const status = evt.peerstatus.toLowerCase() === 'registered' ? 'online' : 'offline';
    console.log(`[AMI] Абонент ${extId}: ${status}`);
    
    // Обновляем статус в Firestore
    updateDoc(doc(db, 'extensions', extId), { status })
      .catch(e => console.error(`[BRIDGE] Ошибка обновления статуса для ${extId}:`, e.message));
  }
});

manager.on('connect', () => console.log('[BRIDGE] Подключено к AMI Asterisk'));
manager.on('error', (err) => console.error('[BRIDGE] Ошибка AMI:', err));
