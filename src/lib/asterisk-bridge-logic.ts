
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

export function rebuildAsteriskConfig() {
  const DATA_DIR = path.resolve(process.cwd(), 'src/data');
  const AST_DIR = '/etc/asterisk';
  const SOUNDS_SRC = path.resolve(DATA_DIR, 'sounds');
  const SOUNDS_DEST = '/var/lib/asterisk/sounds/miac';

  const readJSON = (filename: string) => {
    const file = path.join(DATA_DIR, filename);
    if (!fs.existsSync(file)) return [];
    try {
      const content = fs.readFileSync(file, 'utf8');
      return content ? JSON.parse(content) : [];
    } catch {
      return [];
    }
  };

  const extensions = readJSON('extensions.json');
  const trunks = readJSON('trunks.json');
  const ivrs = readJSON('ivrs.json');
  const queues = readJSON('queues.json');
  const routes = readJSON('routes.json');

  // 1. PJSIP Users
  let usersConfig = '; Генерируемые абоненты МИАЦ.СВЯЗЬ\n\n';
  extensions.forEach((ext: any) => {
    usersConfig += `[${ext.id}]\ntype=endpoint\ncontext=miac-internal\ndisallow=all\nallow=ulaw,alaw\nauth=auth-${ext.id}\naors=${ext.id}\n\n`;
    usersConfig += `[auth-${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
    usersConfig += `[${ext.id}]\ntype=aor\nmax_contacts=5\n\n`;
  });

  // 2. PJSIP Trunks
  let trunksConfig = '; Генерируемые транки МИАЦ.СВЯЗЬ\n\n';
  trunks.forEach((trunk: any) => {
    trunksConfig += `[trunk-${trunk.id}]\ntype=endpoint\ncontext=from-trunk\ndisallow=all\nallow=ulaw,alaw\noutbound_auth=auth-${trunk.id}\naors=aor-${trunk.id}\n\n`;
    trunksConfig += `[auth-${trunk.id}]\ntype=auth\nauth_type=userpass\nusername=${trunk.user}\npassword=${trunk.password}\n\n`;
    trunksConfig += `[aor-${trunk.id}]\ntype=aor\ncontact=sip:${trunk.host}:${trunk.port}\n\n`;
    trunksConfig += `[reg-${trunk.id}]\ntype=registration\noutbound_auth=auth-${trunk.id}\nserver_uri=sip:${trunk.host}:${trunk.port}\nclient_uri=sip:${trunk.user}@${trunk.host}:${trunk.port}\nretry_interval=60\nexpiration=120\n\n`;
    trunksConfig += `[identify-${trunk.id}]\ntype=identify\nendpoint=trunk-${trunk.id}\nmatch=${trunk.host}\n\n`;
  });

  // 3. Queues
  let queuesConfig = '; Генерируемые очереди МИАЦ.СВЯЗЬ\n\n';
  queues.forEach((q: any) => {
    queuesConfig += `[${q.name}]\nstrategy=${q.strategy || 'ringall'}\nmusicclass=${q.musicOnHoldClass || 'default'}\n`;
    (q.members || []).forEach((m: string) => {
      queuesConfig += `member => PJSIP/${m}\n`;
    });
    queuesConfig += `\n`;
  });

  // 4. Dialplan
  let dialplanConfig = '; Генерируемый диалплан МИАЦ.СВЯЗЬ\n\n';
  
  // Добавляем пустой контекст для подавления WARNING если его нет в основной системе
  dialplanConfig += `[from-internal-custom]\n\n`;

  dialplanConfig += `[miac-internal]\n`;
  dialplanConfig += `exten => _X.,1,NoOp(Calling Extension \${EXTEN})\n`;
  dialplanConfig += `same => n,Set(D_STATE=\${DEVICE_STATE(PJSIP/\${EXTEN})})\n`;
  dialplanConfig += `same => n,GotoIf($["\${D_STATE}" = "INVALID"]?check-q:dial)\n`;
  dialplanConfig += `same => n(dial),Dial(PJSIP/\${EXTEN},30)\n`;
  dialplanConfig += `same => n,Hangup()\n`;
  dialplanConfig += `same => n(check-q),GotoIf($["\${QUEUE_EXISTS(\${EXTEN})}" = "1"]?dial-q:fail)\n`;
  dialplanConfig += `same => n(dial-q),Queue(\${EXTEN})\n`;
  dialplanConfig += `same => n,Hangup()\n`;
  dialplanConfig += `same => n(fail),Answer()\n`;
  dialplanConfig += `same => n,Wait(1)\n`;
  dialplanConfig += `same => n,Hangup()\n\n`;

  dialplanConfig += `[from-trunk]\n`;
  const inboundRoutes = routes.filter((r: any) => r.type === 'inbound');
  
  if (inboundRoutes.length === 0) {
    dialplanConfig += `exten => s,1,Hangup()\n`;
    dialplanConfig += `exten => _X.,1,Hangup()\n`;
  } else {
    inboundRoutes.forEach((route: any) => {
      const pattern = route.pattern === '*' ? 's' : route.pattern;
      let destParts = (route.destination || "").split(':');
      let type = destParts[0];
      let id = destParts[1];

      let astTarget = '';
      if (type === 'IVR') {
        astTarget = `miac-ivr-${id},s,1`;
      } else if (type === 'Queue') {
        astTarget = `miac-internal,${id},1`;
      } else if (type === 'Extension') {
        astTarget = `miac-internal,${id},1`;
      }

      if (astTarget) {
        dialplanConfig += `exten => ${pattern},1,NoOp(Incoming to ${pattern})\n`;
        dialplanConfig += `same => n,Set(CHANNEL(language)=ru)\n`;
        dialplanConfig += `same => n,Goto(${astTarget})\n`;
        if (pattern === 's') {
          dialplanConfig += `exten => _X.,1,Goto(s,1)\n`;
        }
      }
    });
  }

  ivrs.forEach((ivr: any) => {
    dialplanConfig += `\n[miac-ivr-${ivr.id}]\n`;
    // Важно: расширение 's' должно иметь приоритет 1 для корректного запуска
    dialplanConfig += `exten => s,1,Answer()\n`;
    dialplanConfig += `same => n,Set(CHANNEL(language)=ru)\n`;
    dialplanConfig += `same => n,Background(/var/lib/asterisk/sounds/miac/${ivr.announcementFile})\n`;
    dialplanConfig += `same => n,WaitExten(10)\n\n`;

    // Обработка донабора
    dialplanConfig += `exten => _X.,1,NoOp(IVR Dialing \${EXTEN})\n`;
    dialplanConfig += `same => n,Set(D_STATE=\${DEVICE_STATE(PJSIP/\${EXTEN})})\n`;
    dialplanConfig += `same => n,GotoIf($["\${D_STATE}" != "INVALID"]?dial-ok)\n`;
    dialplanConfig += `same => n,GotoIf($["\${QUEUE_EXISTS(\${EXTEN})}" = "1"]?dial-ok:dial-err)\n`;
    dialplanConfig += `same => n(dial-ok),Goto(miac-internal,\${EXTEN},1)\n`;
    dialplanConfig += `same => n(dial-err),NoOp(Invalid Destination \${EXTEN})\n`;
    if (ivr.invalidAnnouncementFile) {
        dialplanConfig += `same => n,Playback(/var/lib/asterisk/sounds/miac/${ivr.invalidAnnouncementFile})\n`;
    }
    dialplanConfig += `same => n,Goto(s,1)\n\n`;

    // Кнопки
    (ivr.digitMappings || []).forEach((mapping: string) => {
      const parts = mapping.split(':');
      if (parts.length < 3) return;
      const [digit, type, target] = parts;
      if (type === 'ext') dialplanConfig += `exten => ${digit},1,Goto(miac-internal,${target},1)\n`;
      else if (type === 'queue') dialplanConfig += `exten => ${digit},1,Goto(miac-internal,${target},1)\n`;
      else if (type === 'ivr') dialplanConfig += `exten => ${digit},1,Goto(miac-ivr-${target},s,1)\n`;
    });

    // Таймаут
    dialplanConfig += `exten => t,1,NoOp(IVR Timeout)\n`;
    if (ivr.timeoutDestination) {
      const parts = ivr.timeoutDestination.split(':');
      const [type, target] = parts;
      if (type === 'Extension') dialplanConfig += `same => n,Goto(miac-internal,${target},1)\n`;
      else if (type === 'Queue') dialplanConfig += `same => n,Goto(miac-internal,${target},1)\n`;
      else dialplanConfig += `same => n,Hangup()\n`;
    } else {
      dialplanConfig += `same => n,Hangup()\n`;
    }

    dialplanConfig += `exten => i,1,Goto(s,1)\n\n`;
  });

  try {
    if (fs.existsSync(AST_DIR)) {
      fs.writeFileSync(path.join(AST_DIR, 'pjsip_miac_users.conf'), usersConfig);
      fs.writeFileSync(path.join(AST_DIR, 'pjsip_miac_trunks.conf'), trunksConfig);
      fs.writeFileSync(path.join(AST_DIR, 'queues_miac.conf'), queuesConfig);
      fs.writeFileSync(path.join(AST_DIR, 'extensions_miac_dialplan.conf'), dialplanConfig);
      
      exec('asterisk -rx "pjsip reload"');
      exec('asterisk -rx "dialplan reload"');
      exec('asterisk -rx "queue reload all"');
      console.log('[BRIDGE] Asterisk configs reloaded.');
    }
  } catch (e) {
    console.error('[BRIDGE] Error writing to /etc/asterisk:', e);
  }

  try {
    if (fs.existsSync(SOUNDS_SRC)) {
      if (!fs.existsSync(SOUNDS_DEST)) fs.mkdirSync(SOUNDS_DEST, { recursive: true });
      fs.readdirSync(SOUNDS_SRC).forEach(f => {
        const src = path.join(SOUNDS_SRC, f);
        const dest = path.join(SOUNDS_DEST, f);
        if (fs.statSync(src).isFile()) {
          fs.copyFileSync(src, dest);
          try { fs.chmodSync(dest, 0o666); } catch(e) {}
        }
      });
    }
  } catch (e) {}

  return true;
}
