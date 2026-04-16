
/**
 * @fileOverview Мостик (Bridge) между Firestore и Asterisk.
 * 1. Слушает изменения в Firestore и обновляет /etc/asterisk/pjsip_miac_users.conf
 * 2. Слушает AMI и обновляет статусы абонентов в Firestore.
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import asteriskManager from 'asterisk-manager';
import fs from 'fs';
import { exec } from 'child_process';

// Настройки Firebase
const firebaseConfig = {
  apiKey: "api-key",
  authDomain: "project-id.firebaseapp.com",
  projectId: "project-id",
  storageBucket: "project-id.appspot.com",
  messagingSenderId: "sender-id",
  appId: "app-id"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Настройки AMI (Asterisk Manager Interface)
const ami = new asteriskManager(5038, 'localhost', 'miac', 'MiacAMI2026', true);

const PJSIP_CONF_PATH = '/etc/asterisk/pjsip_miac_users.conf';

console.log("[BRIDGE] Мост МИАЦ.СВЯЗЬ запущен...");

// 1. СЛУШАЕМ FIRESTORE И ОБНОВЛЯЕМ КОНФИГИ
onSnapshot(collection(db, "extensions"), (snapshot) => {
  let configContent = "; АВТОГЕНЕРАЦИЯ МИАЦ.СВЯЗЬ\n; НЕ РЕДАКТИРОВАТЬ ВРУЧНУЮ\n\n";
  
  snapshot.forEach((doc) => {
    const ext = doc.data();
    configContent += `[${ext.id}]\ntype=endpoint\ncontext=${ext.context || 'from-internal'}\ndisallow=all\nallow=alaw,ulaw\nauth=${ext.id}\naors=${ext.id}\ntransport=transport-udp\n\n`;
    configContent += `[${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
    configContent += `[${ext.id}]\ntype=aor\nmax_contacts=1\n\n`;
  });

  try {
    fs.writeFileSync(PJSIP_CONF_PATH, configContent);
    console.log(`[BRIDGE] Файл ${PJSIP_CONF_PATH} обновлен.`);
    
    // Перезагрузка Asterisk
    exec('asterisk -rx "pjsip reload"', (err) => {
      if (err) console.error("[BRIDGE] Ошибка перезагрузки PJSIP:", err);
      else console.log("[BRIDGE] PJSIP Reload выполнен.");
    });
  } catch (e) {
    console.error("[BRIDGE] Ошибка записи файла:", e.message);
  }
});

// 2. СЛУШАЕМ AMI И ОБНОВЛЯЕМ СТАТУСЫ
ami.on('peerstatus', (event) => {
  // Event: PeerStatus, Peer: PJSIP/101, PeerStatus: Registered
  const peer = event.peer.replace('PJSIP/', '');
  const status = event.peerstatus === 'Registered' ? 'online' : 'offline';
  
  console.log(`[AMI] Абонент ${peer} изменил статус на ${status}`);
  
  const extRef = doc(db, "extensions", peer);
  updateDoc(extRef, { status }).catch(e => {
    // Если документа нет, просто игнорируем
  });
});

ami.on('error', (err) => {
  console.error("[AMI] Ошибка подключения:", err);
});

ami.on('connect', () => {
  console.log("[AMI] Успешное подключение к Asterisk.");
});
