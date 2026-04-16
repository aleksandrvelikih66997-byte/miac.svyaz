
/**
 * @fileOverview Bridge-скрипт для синхронизации Firestore -> Asterisk Config.
 * Работает на сервере AltLinux.
 */

import { initializeApp } from "firebase/app";
import { getFirestore, collection, onSnapshot } from "firebase/firestore";
import fs from "fs";
import { exec } from "child_process";
import { firebaseConfig } from "../firebase/config.mjs";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const PJSIP_FILE = "/etc/asterisk/pjsip_miac_users.conf";

console.log("🚀 Bridge активен. Ожидание изменений в Firestore...");

// Слушаем изменения экстеншенов
onSnapshot(collection(db, "extensions"), (snapshot) => {
  let configContent = "; АВТОГЕНЕРИРУЕМЫЙ ФАЙЛ МИАЦ.СВЯЗЬ\n; НЕ РЕДАКТИРОВАТЬ ВРУЧНУЮ\n\n";

  snapshot.forEach((doc) => {
    const ext = doc.data();
    configContent += `[${doc.id}]\ntype=endpoint\nauth=${doc.id}\naors=${doc.id}\ncontext=${ext.context || 'from-internal'}\ndisallow=all\nallow=ulaw,alaw\ndirect_media=no\n\n`;
    configContent += `[${doc.id}]\ntype=auth\nauth_type=userpass\nusername=${doc.id}\npassword=${ext.secret}\n\n`;
    configContent += `[${doc.id}]\ntype=aor\nmax_contacts=1\nremove_existing=yes\n\n`;
  });

  try {
    fs.writeFileSync(PJSIP_FILE, configContent);
    console.log(`[${new Date().toLocaleTimeString()}] ✅ Обновлен ${PJSIP_FILE}`);
    
    // Перезагружаем PJSIP в Asterisk
    exec('asterisk -rx "pjsip reload"', (err) => {
      if (err) console.error("❌ Ошибка reload:", err.message);
    });
  } catch (e) {
    console.error("❌ Ошибка записи файла. Проверьте права доступа к /etc/asterisk/");
  }
});
