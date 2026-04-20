
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

/**
 * Логика генерации конфигурационных файлов Asterisk.
 * Вызывается автоматически при любом изменении данных в веб-интерфейсе.
 */
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

  // 1. PJSIP Users (Абоненты)
  let usersConfig = '; Генерируемые абоненты МИАЦ\n\n';
  extensions.forEach((ext: any) => {
    usersConfig += `[${ext.id}]\ntype=endpoint\ncontext=miac-internal\ndisallow=all\nallow=ulaw,alaw\nauth=auth-${ext.id}\naors=${ext.id}\n\n`;
    usersConfig += `[auth-${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
    usersConfig += `[${ext.id}]\ntype=aor\nmax_contacts=5\n\n`;
  });

  // 2. PJSIP Trunks (Внешние линии)
  let trunksConfig = '; Генерируемые транки МИАЦ\n\n';
  trunks.forEach((trunk: any) => {
    trunksConfig += `[trunk-${trunk.id}]\ntype=endpoint\ncontext=from-trunk\ndisallow=all\nallow=ulaw,alaw\noutbound_auth=auth-${trunk.id}\naors=aor-${trunk.id}\n\n`;
    trunksConfig += `[auth-${trunk.id}]\ntype=auth\nauth_type=userpass\nusername=${trunk.user}\npassword=${trunk.password}\n\n`;
    trunksConfig += `[aor-${trunk.id}]\ntype=aor\ncontact=sip:${trunk.host}:${trunk.port}\n\n`;
    trunksConfig += `[reg-${trunk.id}]\ntype=registration\noutbound_auth=auth-${trunk.id}\nserver_uri=sip:${trunk.host}:${trunk.port}\nclient_uri=sip:${trunk.user}@${trunk.host}:${trunk.port}\nretry_interval=60\nexpiration=120\n\n`;
    trunksConfig += `[identify-${trunk.id}]\ntype=identify\nendpoint=trunk-${trunk.id}\nmatch=${trunk.host}\n\n`;
  });

  // 3. Queues (Очереди)
  let queuesConfig = '; Генерируемые очереди МИАЦ\n\n';
  queues.forEach((q: any) => {
    queuesConfig += `[${q.name}]\nstrategy=${q.strategy || 'ringall'}\nmusicclass=${q.musicOnHoldClass || 'default'}\n`;
    (q.members || []).forEach((m: string) => {
      queuesConfig += `member => PJSIP/${m}\n`;
    });
    queuesConfig += `\n`;
  });

  // 4. Dialplan
  let dialplanConfig = '; Генерируемый диалплан МИАЦ\n\n';
  
  dialplanConfig += `[from-trunk]\n`;
  const inboundRoutes = routes.filter((r: any) => r.type === 'inbound');
  
  if (inboundRoutes.length > 0) {
    inboundRoutes.forEach((route: any) => {
      const pattern = route.pattern === '*' ? 's' : route.pattern;
      let target = '';
      if (route.destination.startsWith('IVR:')) {
        target = `miac-ivr-${route.destination.split(':')[1]},s,1`;
      } else if (route.destination.startsWith('Queue:')) {
        target = `miac-queues,${route.destination.split(':')[1]},1`;
      } else if (route.destination.startsWith('Extension:')) {
        target = `miac-internal,${route.destination.split(':')[1]},1`;
      }
      
      if (target) {
        dialplanConfig += `exten => ${pattern},1,Goto(${target})\n`;
        if (pattern === 's') dialplanConfig += `exten => _.,1,Goto(${target})\n`;
      }
    });
  } else if (ivrs.length > 0) {
    dialplanConfig += `exten => s,1,Goto(miac-ivr-${ivrs[0].id},s,1)\n`;
    dialplanConfig += `exten => _.,1,Goto(miac-ivr-${ivrs[0].id},s,1)\n`;
  }
  dialplanConfig += `exten => s,n,Hangup()\n\n`;

  ivrs.forEach((ivr: any) => {
    dialplanConfig += `[miac-ivr-${ivr.id}]\n`;
    dialplanConfig += `exten => s,1,Answer()\n`;
    dialplanConfig += `exten => s,n,Progress()\n`;
    dialplanConfig += `exten => s,n,Wait(1)\n`;
    dialplanConfig += `exten => s,n,Background(/var/lib/asterisk/sounds/miac/${ivr.announcementFile})\n`;
    dialplanConfig += `exten => s,n,WaitExten(5)\n`;

    (ivr.digitMappings || []).forEach((mapping: string) => {
      const parts = mapping.split(':');
      if (parts.length < 3) return;
      const [digit, type, target] = parts;
      if (type === 'ext') dialplanConfig += `exten => ${digit},1,Dial(PJSIP/${target},30)\n`;
      else if (type === 'queue') dialplanConfig += `exten => ${digit},1,Queue(${target})\n`;
      else if (type === 'ivr') dialplanConfig += `exten => ${digit},1,Goto(miac-ivr-${target},s,1)\n`;
    });

    if (ivr.timeoutDestination) {
      const parts = ivr.timeoutDestination.split(':');
      if (parts.length >= 2) {
        const [type, target] = parts;
        if (type === 'Extension') dialplanConfig += `exten => t,1,Dial(PJSIP/${target},30)\n`;
        else if (type === 'Queue') dialplanConfig += `exten => t,1,Queue(${target})\n`;
      }
    } else {
      dialplanConfig += `exten => t,1,Hangup()\n`;
    }
    dialplanConfig += `\n`;
  });

  dialplanConfig += `[miac-internal]\n`;
  dialplanConfig += `exten => _XXX,1,Dial(PJSIP/\${EXTEN},30)\n`;
  dialplanConfig += `exten => _XXX,n,Hangup()\n\n`;

  try {
    if (fs.existsSync(AST_DIR)) {
      fs.writeFileSync(path.join(AST_DIR, 'pjsip_miac_users.conf'), usersConfig);
      fs.writeFileSync(path.join(AST_DIR, 'pjsip_miac_trunks.conf'), trunksConfig);
      fs.writeFileSync(path.join(AST_DIR, 'queues_miac.conf'), queuesConfig);
      fs.writeFileSync(path.join(AST_DIR, 'extensions_miac_dialplan.conf'), dialplanConfig);
      exec('asterisk -rx "core reload"');
      console.log('[BRIDGE] Files updated and Asterisk reloaded.');
    } else {
      console.log('[BRIDGE] /etc/asterisk not found. Generation skipped.');
    }
  } catch (e) {
    console.error('[BRIDGE] Write Error:', e);
  }

  try {
    if (fs.existsSync(SOUNDS_SRC)) {
      if (!fs.existsSync(SOUNDS_DEST)) fs.mkdirSync(SOUNDS_DEST, { recursive: true });
      fs.readdirSync(SOUNDS_SRC).forEach(f => {
        const src = path.join(SOUNDS_SRC, f);
        const dest = path.join(SOUNDS_DEST, f);
        fs.copyFileSync(src, dest);
        fs.chmodSync(dest, 0o666);
      });
    }
  } catch (e) {}

  return true;
}
