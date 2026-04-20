
'use server';

import fs from 'fs';
import path from 'path';
import { getLocalSession } from './auth-local';

const DATA_DIR = path.resolve(process.cwd(), 'src/data');
const LOGS_FILE = path.join(DATA_DIR, 'audit_logs.json');

export type AuditAction = 
  | 'LOGIN' 
  | 'LOGOUT' 
  | 'SAVE_EXTENSION' 
  | 'DELETE_EXTENSION' 
  | 'SAVE_TRUNK' 
  | 'DELETE_TRUNK' 
  | 'SAVE_ROUTE' 
  | 'DELETE_ROUTE'
  | 'SAVE_QUEUE'
  | 'DELETE_QUEUE'
  | 'SAVE_IVR'
  | 'DELETE_IVR'
  | 'CREATE_ADMIN'
  | 'DELETE_ADMIN'
  | 'SYSTEM_RELOAD';

export async function logAuditAction(action: AuditAction, details: string) {
  try {
    const session = await getLocalSession();
    const user = session?.email || 'System';
    
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    let logs = [];
    if (fs.existsSync(LOGS_FILE)) {
      const content = fs.readFileSync(LOGS_FILE, 'utf8');
      logs = content ? JSON.parse(content) : [];
    }

    const newLog = {
      timestamp: new Date().toISOString(),
      user,
      action,
      details
    };

    logs.unshift(newLog); // Новые сверху
    
    const limitedLogs = logs.slice(0, 500);
    
    fs.writeFileSync(LOGS_FILE, JSON.stringify(limitedLogs, null, 2));
    return { success: true };
  } catch (error) {
    console.error('[AUDIT] Failed to write log:', error);
    return { success: false };
  }
}

export async function getAuditLogs() {
  try {
    if (!fs.existsSync(LOGS_FILE)) return [];
    const content = fs.readFileSync(LOGS_FILE, 'utf8');
    return content ? JSON.parse(content) : [];
  } catch {
    return [];
  }
}
