
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

/**
 * @fileOverview Генерация диалплана и конфигураций Asterisk.
 * Добавлена поддержка расширенных параметров PJSIP для работы с провайдерами (NAT, Realm, FromUser).
 */
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

  // 1. IVR Contexts
  let ivrConfig = '';
  ivrs.forEach((ivr: any) => {
    ivrConfig += `[miac-ivr-${ivr.id}]\n`;
    ivrConfig += `exten => s,1,Answer()\n`;
    ivrConfig += `exten => s,2,NoOp(IVR START: ${ivr.name})\n`;
    ivrConfig += `exten => s,3,Background(/var/lib/asterisk/sounds/miac/${ivr.announcementFile})\n`;
    ivrConfig += `exten => s,4,WaitExten(10)\n`;

    (ivr.digitMappings || []).forEach((mapping: string) => {
      const parts = mapping.split(':');
      if (parts.length < 3) return;
      const [digit, type, target] = parts;
      ivrConfig += `exten => ${digit},1,Goto(miac-internal,${target},1)\n`;
    });

    ivrConfig += `exten => t,1,NoOp(IVR Timeout)\n`;
    if (ivr.timeoutDestination) {
      const destParts = ivr.timeoutDestination.split(':');
      ivrConfig += `exten => t,2,Goto(miac-internal,${destParts[1] || 's'},1)\n`;
    } else {
      ivrConfig += `exten => t,2,Hangup()\n`;
    }

    ivrConfig += `exten => i,1,NoOp(IVR Invalid)\n`;
    ivrConfig += `exten => i,2,Goto(s,1)\n\n`;
  });

  let dialplanConfig = `; Генерируемый диалплан МИАЦ.СВЯЗЬ (v1.0)\n\n${ivrConfig}`;

  // 2. Internal Context
  dialplanConfig += `[miac-internal]\n`;
  dialplanConfig += `exten => _X.,1,NoOp(MIAC CALL: \${EXTEN})\n`;
  dialplanConfig += `exten => _X.,2,Set(D_STATE=\${DEVICE_STATE(PJSIP/\${EXTEN})})\n`;
  dialplanConfig += `exten => _X.,3,GotoIf($["\${D_STATE}" = "INVALID"]?dial-q:dial-ext)\n`;
  dialplanConfig += `exten => _X.,4(dial-ext),Dial(PJSIP/\${EXTEN},30)\n`;
  dialplanConfig += `exten => _X.,5,Hangup()\n`;
  dialplanConfig += `exten => _X.,6(dial-q),NoOp(Dialing Queue: \${EXTEN})\n`;
  dialplanConfig += `exten => _X.,7,Queue(\${EXTEN},,,,30)\n`;
  dialplanConfig += `exten => _X.,8,Hangup()\n\n`;

  // 3. Inbound Context (from trunk)
  dialplanConfig += `[from-trunk]\n`;
  const inboundRoutes = routes.filter((r: any) => r.type === 'inbound');
  
  dialplanConfig += `exten => s,1,Answer()\n`;
  dialplanConfig += `exten => s,2,NoOp(Incoming call from trunk)\n`;
  
  if (inboundRoutes.length === 0) {
    dialplanConfig += `exten => s,3,Hangup()\n`;
  } else {
    inboundRoutes.forEach((route: any) => {
      const pattern = route.pattern === '*' ? 's' : route.pattern;
      let destParts = (route.destination || "").split(':');
      let type = destParts[0];
      let id = destParts[1];
      let astTarget = (type === 'IVR') ? `miac-ivr-${id},s,1` : `miac-internal,${id},1`;
      
      if (pattern === 's') {
        dialplanConfig += `exten => s,3,Goto(${astTarget})\n`;
      } else {
        dialplanConfig += `exten => ${pattern},1,Goto(${astTarget})\n`;
      }
    });
    dialplanConfig += `exten => _X.,1,Goto(s,1)\n`;
  }

  // PJSIP Users
  let usersConfig = '; Генерируемые абоненты МИАЦ.СВЯЗЬ\n\n';
  extensions.forEach((ext: any) => {
    usersConfig += `[${ext.id}]\ntype=endpoint\ncontext=miac-internal\ndisallow=all\nallow=ulaw,alaw\nauth=auth-${ext.id}\naors=${ext.id}\n\n`;
    usersConfig += `[auth-${ext.id}]\ntype=auth\nauth_type=userpass\nusername=${ext.id}\npassword=${ext.secret}\n\n`;
    usersConfig += `[${ext.id}]\ntype=aor\nmax_contacts=5\n\n`;
  });

  // PJSIP Trunks (Advanced Version)
  let trunksConfig = '; Генерируемые транки МИАЦ.СВЯЗЬ (v1.1)\n\n';
  trunks.forEach((trunk: any) => {
    // Endpoint
    trunksConfig += `[trunk-${trunk.id}]\ntype=endpoint\ncontext=from-trunk\ndisallow=all\nallow=ulaw,alaw\n`;
    trunksConfig += `outbound_auth=auth-${trunk.id}\naors=aor-${trunk.id}\n`;
    trunksConfig += `transport=transport-udp-nat\n`;
    if (trunk.domain) trunksConfig += `from_domain=${trunk.domain}\n`;
    trunksConfig += `from_user=${trunk.user}\nsend_pai=yes\ntrust_id_outbound=yes\n\n`;

    // Auth
    trunksConfig += `[auth-${trunk.id}]\ntype=auth\nauth_type=userpass\nusername=${trunk.user}\npassword=${trunk.password}\n`;
    if (trunk.domain) trunksConfig += `realm=${trunk.domain}\n`;
    trunksConfig += `\n`;

    // AOR
    const contactUri = trunk.domain ? `sip:${trunk.user}@${trunk.domain}` : `sip:${trunk.host}:${trunk.port}`;
    trunksConfig += `[aor-${trunk.id}]\ntype=aor\ncontact=${contactUri}\nqualify_frequency=60\nmax_contacts=1\n\n`;

    // Registration
    trunksConfig += `[reg-${trunk.id}]\ntype=registration\ntransport=transport-udp-nat\n`;
    trunksConfig += `outbound_auth=auth-${trunk.id}\n`;
    trunksConfig += `server_uri=sip:${trunk.host}:${trunk.port}\n`;
    trunksConfig += `client_uri=sip:${trunk.user}@${trunk.domain || trunk.host}\n`;
    trunksConfig += `contact_user=${trunk.user}\nretry_interval=60\nexpiration=3600\n\n`;

    // Identify
    trunksConfig += `[identify-${trunk.id}]\ntype=identify\nendpoint=trunk-${trunk.id}\nmatch=${trunk.domain || trunk.host}\n\n`;
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
