
import fs from 'fs';
import path from 'path';

/**
 * Логика генерации конфигурационных файлов Asterisk.
 * Используется как в скрипте моста, так и напрямую из веб-приложения.
 */
export function rebuildAsteriskConfig() {
  const DATA_DIR = path.resolve(process.cwd(), 'src/data');
  const AST_DIR = '/etc/asterisk';
  const SOUNDS_SRC = path.resolve(DATA_DIR, 'sounds');
  const SOUNDS_DEST = '/var/lib/asterisk/sounds/miac';

  // Вспомогательная функция чтения JSON
  const readJSON = (filename: string) => {
    const file = path.join(DATA_DIR, filename);
    if (!fs.existsSync(file)) return [];
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return [];
    }
  };

  const extensions = readJSON('extensions.json');
  const trunks = readJSON('trunks.json');
  const ivrs = readJSON('ivrs.json');
  const queues = readJSON('queues.json');
  const routes = readJSON('routes.json');

  // 1. Абоненты (PJSIP Users)
  let usersConfig = '; Генерируемые абоненты МИАЦ\n\n';
  extensions.forEach((ext: any) => {
    usersConfig += `[${ext.id}]\ntype=endpoint\ncontext=miac-internal\ndisallow=all\nallow=ulaw,alaw\nauth=auth-${ext.id}\naors=${ext.id}\n\n`;
    usersConfig += `[auth-${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
    usersConfig += `[${ext.id}]\ntype=aor\nmax_contacts=5\n\n`;
  });

  // 2. Транки (PJSIP Trunks)
  let trunksConfig = '; Генерируемые транки МИАЦ\n\n';
  trunks.forEach((trunk: any) => {
    trunksConfig += `[trunk-${trunk.id}]\ntype=endpoint\ncontext=from-trunk\ndisallow=all\nallow=ulaw,alaw\noutbound_auth=auth-${trunk.id}\naors=aor-${trunk.id}\n\n`;
    trunksConfig += `[auth-${trunk.id}]\ntype=auth\nauth_type=userpass\nusername=${trunk.user}\npassword=${trunk.password}\n\n`;
    trunksConfig += `[aor-${trunk.id}]\ntype=aor\ncontact=sip:${trunk.host}:${trunk.port}\n\n`;
    trunksConfig += `[reg-${trunk.id}]\ntype=registration\noutbound_auth=auth-${trunk.id}\nserver_uri=sip:${trunk.host}:${trunk.port}\nclient_uri=sip:${trunk.user}@${trunk.host}:${trunk.port}\nretry_interval=60\nexpiration=120\n\n`;
    trunksConfig += `[identify-${trunk.id}]\ntype=identify\nendpoint=trunk-${trunk.id}\nmatch=${trunk.host}\n\n`;
  });

  // 3. Очереди (Queues)
  let queuesConfig = '; Генерируемые очереди МИАЦ\n\n';
  queues.forEach((q: any) => {
    queuesConfig += `[${q.name}]\nstrategy=${q.strategy}\nmusicclass=${q.musicOnHoldClass || 'default'}\n`;
    (q.members || []).forEach((m: string) => {
      queuesConfig += `member => PJSIP/${m}\n`;
    });
    queuesConfig += `\n`;
  });

  // 4. Диалплан (Extensions)
  let dialplanConfig = '; Генерируемый диалплан МИАЦ\n\n';

  // Входящие
  const firstIvrId = ivrs.length > 0 ? ivrs[0].id : null;
  dialplanConfig += `[from-trunk]\n`;
  if (firstIvrId) {
    dialplanConfig += `exten => s,1,Goto(miac-ivr-${firstIvrId},s,1)\n`;
    dialplanConfig += `exten => _.,1,Goto(miac-ivr-${firstIvrId},s,1)\n`;
  } else {
    dialplanConfig += `exten => s,1,Hangup()\n`;
  }
  dialplanConfig += `\n`;

  // IVR
  ivrs.forEach((ivr: any) => {
    dialplanConfig += `[miac-ivr-${ivr.id}]\n`;
    dialplanConfig += `exten => s,1,Answer()\n`;
    dialplanConfig += `exten => s,n,Progress()\n`;
    dialplanConfig += `exten => s,n,Wait(1)\n`;
    dialplanConfig += `exten => s,n,Background(miac/${ivr.announcementFile})\n`;
    dialplanConfig += `exten => s,n,WaitExten(5)\n`;

    // Кнопки
    (ivr.digitMappings || []).forEach((mapping: string) => {
      const [digit, type, target] = mapping.split(':');
      if (type === 'ext') dialplanConfig += `exten => ${digit},1,Goto(miac-internal,${target},1)\n`;
      if (type === 'queue') dialplanConfig += `exten => ${digit},1,Queue(${target})\n`;
      if (type === 'ivr') dialplanConfig += `exten => ${digit},1,Goto(miac-ivr-${target},s,1)\n`;
    });

    // Таймаут
    if (ivr.timeoutDestination) {
      const [type, target] = ivr.timeoutDestination.split(':');
      if (type === 'Extension') dialplanConfig += `exten => t,1,Dial(PJSIP/${target},30)\n`;
      else if (type === 'Queue') dialplanConfig += `exten => t,1,Queue(${target})\n`;
      else dialplanConfig += `exten => t,1,Hangup()\n`;
    } else {
      dialplanConfig += `exten => t,1,Hangup()\n`;
    }
    dialplanConfig += `\n`;
  });

  // Внутренние
  dialplanConfig += `[miac-internal]\n`;
  dialplanConfig += `exten => _XXX,1,Dial(PJSIP/\${EXTEN},30)\n`;
  dialplanConfig += `exten => _XXX,n,Hangup()\n`;

  // Запись файлов (если есть права)
  try {
    fs.writeFileSync(path.join(AST_DIR, 'pjsip_miac_users.conf'), usersConfig);
    fs.writeFileSync(path.join(AST_DIR, 'pjsip_miac_trunks.conf'), trunksConfig);
    fs.writeFileSync(path.join(AST_DIR, 'queues_miac.conf'), queuesConfig);
    fs.writeFileSync(path.join(AST_DIR, 'extensions_miac_dialplan.conf'), dialplanConfig);
    console.log('Asterisk configs updated successfully.');
  } catch (e) {
    console.warn('Could not write Asterisk configs. Make sure /etc/asterisk is writable.');
  }

  // Копирование звуков
  if (fs.existsSync(SOUNDS_SRC)) {
    try {
      if (!fs.existsSync(SOUNDS_DEST)) fs.mkdirSync(SOUNDS_DEST, { recursive: true });
      const files = fs.readdirSync(SOUNDS_SRC);
      files.forEach(f => {
        fs.copyFileSync(path.join(SOUNDS_SRC, f), path.join(SOUNDS_DEST, f));
      });
      console.log('Sounds copied to Asterisk sounds directory.');
    } catch (e) {
      console.warn('Could not copy sounds to Asterisk directory.');
    }
  }

  return true;
}
