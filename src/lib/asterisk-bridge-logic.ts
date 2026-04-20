
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

export function rebuildAsteriskConfig() {
  const DATA_DIR = path.resolve(process.cwd(), 'src/data');
  const AST_DIR = '/etc/asterisk';

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

  let dialplanConfig = '; Генерируемый диалплан МИАЦ.СВЯЗЬ (v1.0)\n\n';

  // 1. IVR Contexts (Должны быть вверху для корректной регистрации)
  ivrs.forEach((ivr: any) => {
    dialplanConfig += `[miac-ivr-${ivr.id}]\n`;
    dialplanConfig += `exten => s,1,Answer()\n`;
    dialplanConfig += `exten => s,2,NoOp(IVR Menu: ${ivr.name})\n`;
    dialplanConfig += `exten => s,3,Background(/var/lib/asterisk/sounds/miac/${ivr.announcementFile})\n`;
    dialplanConfig += `exten => s,4,WaitExten(10)\n\n`;

    // Донабор (Кнопки)
    (ivr.digitMappings || []).forEach((mapping: string) => {
      const parts = mapping.split(':');
      if (parts.length < 3) return;
      const [digit, type, target] = parts;
      if (type === 'ext') dialplanConfig += `exten => ${digit},1,Goto(miac-internal,${target},1)\n`;
      else if (type === 'queue') dialplanConfig += `exten => ${digit},1,Goto(miac-internal,${target},1)\n`;
      else if (type === 'ivr') dialplanConfig += `exten => ${digit},1,Goto(miac-ivr-${target},s,1)\n`;
    });

    // Прямой донабор внутреннего номера
    dialplanConfig += `exten => _X.,1,NoOp(IVR Direct Dialing: \${EXTEN})\n`;
    dialplanConfig += `exten => _X.,2,Goto(miac-internal,\${EXTEN},1)\n\n`;

    // Таймаут и ошибки
    dialplanConfig += `exten => t,1,NoOp(IVR Timeout)\n`;
    if (ivr.timeoutDestination) {
      const parts = ivr.timeoutDestination.split(':');
      const target = parts[1];
      dialplanConfig += `exten => t,2,Goto(miac-internal,${target},1)\n`;
    } else {
      dialplanConfig += `exten => t,2,Hangup()\n`;
    }

    dialplanConfig += `exten => i,1,NoOp(IVR Invalid Input)\n`;
    dialplanConfig += `exten => i,2,Goto(s,1)\n\n`;
  });

  // 2. Internal Context
  dialplanConfig += `[miac-internal]\n`;
  dialplanConfig += `exten => _X.,1,NoOp(Dialing: \${EXTEN})\n`;
  dialplanConfig += `exten => _X.,2,Set(D_STATE=\${DEVICE_STATE(PJSIP/\${EXTEN})})\n`;
  dialplanConfig += `exten => _X.,3,GotoIf($["\${D_STATE}" = "INVALID"]?check-q:dial-ext)\n`;
  dialplanConfig += `exten => _X.,4(dial-ext),Dial(PJSIP/\${EXTEN},30)\n`;
  dialplanConfig += `exten => _X.,5,Hangup()\n`;
  dialplanConfig += `exten => _X.,6(check-q),NoOp(Checking Queue: \${EXTEN})\n`;
  dialplanConfig += `exten => _X.,7,Queue(\${EXTEN})\n`;
  dialplanConfig += `exten => _X.,8,Hangup()\n\n`;

  // 3. Trunk Context (Входящие)
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
      } else {
        astTarget = `miac-internal,${id},1`;
      }

      dialplanConfig += `exten => ${pattern},1,NoOp(Incoming to ${pattern})\n`;
      dialplanConfig += `exten => ${pattern},2,Goto(${astTarget})\n`;
      if (pattern === 's') {
        dialplanConfig += `exten => _X.,1,Goto(s,1)\n`;
      }
    });
  }

  // 4. PJSIP Configs
  let usersConfig = '; Генерируемые абоненты МИАЦ.СВЯЗЬ\n\n';
  extensions.forEach((ext: any) => {
    usersConfig += `[${ext.id}]\ntype=endpoint\ncontext=miac-internal\ndisallow=all\nallow=ulaw,alaw\nauth=auth-${ext.id}\naors=${ext.id}\n\n`;
    usersConfig += `[auth-${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
    usersConfig += `[${ext.id}]\ntype=aor\nmax_contacts=5\n\n`;
  });

  let trunksConfig = '; Генерируемые транки МИАЦ.СВЯЗЬ\n\n';
  trunks.forEach((trunk: any) => {
    trunksConfig += `[trunk-${trunk.id}]\ntype=endpoint\ncontext=from-trunk\ndisallow=all\nallow=ulaw,alaw\noutbound_auth=auth-${trunk.id}\naors=aor-${trunk.id}\n\n`;
    trunksConfig += `[auth-${trunk.id}]\ntype=auth\nauth_type=userpass\nusername=${trunk.user}\npassword=${trunk.password}\n\n`;
    trunksConfig += `[aor-${trunk.id}]\ntype=aor\ncontact=sip:${trunk.host}:${trunk.port}\n\n`;
    trunksConfig += `[reg-${trunk.id}]\ntype=registration\noutbound_auth=auth-${trunk.id}\nserver_uri=sip:${trunk.host}:${trunk.port}\nclient_uri=sip:${trunk.user}@${trunk.host}:${trunk.port}\nretry_interval=60\nexpiration=120\n\n`;
    trunksConfig += `[identify-${trunk.id}]\ntype=identify\nendpoint=trunk-${trunk.id}\nmatch=${trunk.host}\n\n`;
  });

  let queuesConfig = '; Генерируемые очереди МИАЦ.СВЯЗЬ\n\n';
  queues.forEach((q: any) => {
    queuesConfig += `[${q.name}]\nstrategy=${q.strategy || 'ringall'}\nmusicclass=${q.musicOnHoldClass || 'default'}\n`;
    (q.members || []).forEach((m: string) => {
      queuesConfig += `member => PJSIP/${m}\n`;
    });
    queuesConfig += `\n`;
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
    }
  } catch (e) {
    console.error('[BRIDGE] Sync Error:', e);
  }

  return true;
}
