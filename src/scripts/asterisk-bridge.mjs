
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { firebaseConfig } from '../firebase/config.mjs';
import asteriskManager from 'asterisk-manager';
import fs from 'fs';
import { exec } from 'child_process';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Настройки AMI (соответствуют вашему manager.conf)
const ami = asteriskManager(5038, 'localhost', 'miac', 'MiacAMI2026', true);

ami.on('managerevent', (evt) => {
  if (evt.event === 'PeerStatus') {
    const peer = evt.peer.replace('PJSIP/', '');
    const status = evt.peerstatus === 'Registered' ? 'online' : 'offline';
    
    // Обновляем статус в Firestore
    const extRef = doc(db, 'extensions', peer);
    updateDoc(extRef, { status }).catch(() => {});
    console.log(`[AMI] Статус абонента ${peer}: ${status}`);
  }
});

// Синхронизация из Firestore в Asterisk
onSnapshot(collection(db, 'extensions'), (snapshot) => {
  let config = '; Генерируемый файл МИАЦ.СВЯЗЬ\n';
  config += '[transport-udp]\ntype=transport\nprotocol=udp\nbind=0.0.0.0:5060\n\n';

  snapshot.forEach((doc) => {
    const data = doc.data();
    config += `[${data.id}]\ntype=endpoint\ncontext=${data.context || 'from-internal'}\ndisallow=all\nallow=ulaw,alaw\nauth=auth${data.id}\naors=${data.id}\ntransport=transport-udp\n\n`;
    config += `[auth${data.id}]\ntype=auth\nauth_type=userpass\nusername=${data.id}\npassword=${data.secret}\n\n`;
    config += `[${data.id}]\ntype=aor\nmax_contacts=1\n\n`;
  });

  fs.writeFileSync('/etc/asterisk/pjsip_miac_users.conf', config);
  
  exec('asterisk -rx "core reload"', (err) => {
    if (err) console.error('[ERROR] Ошибка перезагрузки Asterisk:', err);
    else console.log('[BRIDGE] Конфигурация обновлена и применена.');
  });
});

console.log('[BRIDGE] Мост запущен и слушает изменения...');
