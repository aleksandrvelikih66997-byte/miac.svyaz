
'use server';

import fs from 'fs';
import path from 'path';
import { rebuildAsteriskConfig } from './asterisk-bridge-logic';

const DATA_DIR = path.resolve(process.cwd(), 'src/data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const FILES = {
  extensions: path.join(DATA_DIR, 'extensions.json'),
  trunks: path.join(DATA_DIR, 'trunks.json'),
  routes: path.join(DATA_DIR, 'routes.json'),
  queues: path.join(DATA_DIR, 'queues.json'),
  ivrs: path.join(DATA_DIR, 'ivrs.json'),
};

function readJSON(file: string) {
  if (!fs.existsSync(file)) return [];
  try {
    const content = fs.readFileSync(file, 'utf8');
    return content ? JSON.parse(content) : [];
  } catch (e) {
    return [];
  }
}

function writeJSON(file: string, data: any) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  // Автоматическая пересборка конфигов при сохранении данных
  try {
    rebuildAsteriskConfig();
  } catch (e) {
    console.error('Bridge auto-rebuild failed:', e);
  }
}

// Extensions
export async function getExtensions() { return readJSON(FILES.extensions); }
export async function saveExtension(ext: any) {
  const data = readJSON(FILES.extensions);
  const index = data.findIndex((e: any) => e.id === ext.id);
  const now = new Date().toISOString();
  if (index > -1) { data[index] = { ...data[index], ...ext, lastUpdateDate: now }; }
  else { data.push({ ...ext, creationDate: now, lastUpdateDate: now }); }
  writeJSON(FILES.extensions, data);
  return { success: true };
}
export async function deleteExtension(id: string) {
  const data = readJSON(FILES.extensions).filter((e: any) => e.id !== id);
  writeJSON(FILES.extensions, data);
  return { success: true };
}

// Trunks
export async function getTrunks() { return readJSON(FILES.trunks); }
export async function saveTrunk(trunk: any) {
  const data = readJSON(FILES.trunks);
  const id = trunk.id || trunk.name.toLowerCase().replace(/\s+/g, '-');
  const now = new Date().toISOString();
  const trunkWithId = { ...trunk, id, lastUpdateDate: now };
  const index = data.findIndex((t: any) => t.id === id);
  if (index > -1) { data[index] = trunkWithId; }
  else { trunkWithId.creationDate = now; data.push(trunkWithId); }
  writeJSON(FILES.trunks, data);
  return { success: true };
}
export async function deleteTrunk(id: string) {
  const data = readJSON(FILES.trunks).filter((t: any) => t.id !== id);
  writeJSON(FILES.trunks, data);
  return { success: true };
}

// Routes
export async function getRoutes() { return readJSON(FILES.routes); }
export async function saveRoute(route: any) {
  const data = readJSON(FILES.routes);
  const id = route.id || Math.random().toString(36).substr(2, 9);
  const now = new Date().toISOString();
  const routeWithId = { ...route, id, lastUpdateDate: now };
  const index = data.findIndex((r: any) => r.id === id);
  if (index > -1) { data[index] = routeWithId; }
  else { routeWithId.creationDate = now; data.push(routeWithId); }
  writeJSON(FILES.routes, data);
  return { success: true };
}
export async function deleteRoute(id: string) {
  const data = readJSON(FILES.routes).filter((r: any) => r.id !== id);
  writeJSON(FILES.routes, data);
  return { success: true };
}

// Queues
export async function getQueues() { return readJSON(FILES.queues); }
export async function saveQueue(queue: any) {
  const data = readJSON(FILES.queues);
  const id = queue.id || Math.random().toString(36).substr(2, 9);
  const now = new Date().toISOString();
  const item = { ...queue, id, lastUpdateDate: now };
  const index = data.findIndex((q: any) => q.id === id);
  if (index > -1) data[index] = item; else { item.creationDate = now; data.push(item); }
  writeJSON(FILES.queues, data);
  return { success: true };
}
export async function deleteQueue(id: string) {
  const data = readJSON(FILES.queues).filter((q: any) => q.id !== id);
  writeJSON(FILES.queues, data);
  return { success: true };
}

// IVRs
export async function getIvrs() { return readJSON(FILES.ivrs); }
export async function saveIvr(ivr: any) {
  const data = readJSON(FILES.ivrs);
  const id = ivr.id || Math.random().toString(36).substr(2, 9);
  const now = new Date().toISOString();
  const item = { ...ivr, id, lastUpdateDate: now };
  const index = data.findIndex((i: any) => i.id === id);
  if (index > -1) data[index] = item; else { item.creationDate = now; data.push(item); }
  writeJSON(FILES.ivrs, data);
  return { success: true };
}
export async function deleteIvr(id: string) {
  const data = readJSON(FILES.ivrs).filter((i: any) => i.id !== id);
  writeJSON(FILES.ivrs, data);
  return { success: true };
}
