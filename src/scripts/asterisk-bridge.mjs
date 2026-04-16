
import { initializeApp } from "firebase/app";
import { getFirestore, collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import aml from "asterisk-manager";
import { writeFileSync } from "fs";
import { exec } from "child_process";

// Конфигурация Firebase
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

// Настройки AMI
const ami = new aml(5038, 'localhost', 'miac', 'MiacAMI2026', true);
ami.keepConnected();

console.log("--- МИАЦ.СВЯЗЬ: Запуск моста синхронизации ---");

// 1. Слушаем изменения абонентов в Firestore и обновляем pjsip_miac_users.conf
onSnapshot(collection(db, "extensions"), (snapshot) => {
  let configContent = "; --- МИАЦ.СВЯЗЬ: Автоматически сгенерированный файл ---\n\n";
  
  snapshot.forEach((doc) => {
    const ext = doc.data();
    configContent += `[${ext.id}]\ntype=endpoint\ncontext=${ext.context || 'from-internal'}\ndisallow=all\nallow=ulaw,alaw\nauth=${ext.id}\naors=${ext.id}\ntransport=transport-udp\n\n`;
    configContent += `[${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
    configContent += `[${ext.id}]\ntype=aor\nmax_contacts=1\n\n`;
  });

  try {
    writeFileSync("/etc/asterisk/pjsip_miac_users.conf", configContent);
    console.log("[BRIDGE] Файл pjsip_miac_users.conf обновлен.");
    
    // Перезагружаем Asterisk
    exec('asterisk -rx "core reload"', (err) => {
      if (!err) console.log("[BRIDGE] Команда core reload выполнена.");
    });
  } catch (e) {
    console.error("[BRIDGE] ОШИБКА записи файла. Проверьте права на /etc/asterisk/");
  }
});

// 2. Слушаем события регистрации из AMI и обновляем статусы в Firestore
ami.on('peerstatus', (evt) => {
  const peer = evt.peer.split('/')[1]; // PJSIP/101 -> 101
  if (!peer) return;

  const status = evt.peerstatus === 'Registered' ? 'online' : 'offline';
  console.log(`[AMI] Изменение статуса: ${peer} -> ${status}`);

  updateDoc(doc(db, "extensions", peer), { status }).catch(() => {});
});

ami.on('managerevent', (evt) => {
  // Можно добавить дополнительные события (Busy и т.д.)
});
