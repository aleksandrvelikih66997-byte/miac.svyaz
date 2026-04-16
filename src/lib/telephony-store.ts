
'use server';

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'src/data');

// Инициализация директории данных
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const FILES = {
  extensions: path.join(DATA_DIR, 'extensions.json'),
  trunks: path.join(DATA_DIR, 'trunks.json'),
  routes: path.join(DATA_DIR, 'routes.json'),
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
}

export async function getExtensions() {
  return readJSON(FILES.extensions);
}

export async function saveExtension(ext: any) {
  const data = readJSON(FILES.extensions);
  const index = data.findIndex((e: any) => e.id === ext.id);
  const now = new Date().toISOString();
  
  if (index > -1) {
    data[index] = { ...data[index], ...ext, lastUpdateDate: now };
  } else {
    data.push({ 
      ...ext, 
      creationDate: now,
      lastUpdateDate: now 
    });
  }
  writeJSON(FILES.extensions, data);
  return { success: true };
}

export async function deleteExtension(id: string) {
  const data = readJSON(FILES.extensions).filter((e: any) => e.id !== id);
  writeJSON(FILES.extensions, data);
  return { success: true };
}

export async function getTrunks() {
  return readJSON(FILES.trunks);
}

export async function saveTrunk(trunk: any) {
  const data = readJSON(FILES.trunks);
  const id = trunk.id || trunk.name.toLowerCase().replace(/\s+/g, '-');
  const now = new Date().toISOString();
  
  const trunkWithId = { ...trunk, id, lastUpdateDate: now };
  const index = data.findIndex((t: any) => t.id === id);
  if (index > -1) {
    data[index] = trunkWithId;
  } else {
    trunkWithId.creationDate = now;
    data.push(trunkWithId);
  }
  writeJSON(FILES.trunks, data);
  return { success: true };
}

export async function deleteTrunk(id: string) {
  const data = readJSON(FILES.trunks).filter((t: any) => t.id !== id);
  writeJSON(FILES.trunks, data);
  return { success: true };
}

export async function getRoutes() {
  return readJSON(FILES.routes);
}

export async function saveRoute(route: any) {
  const data = readJSON(FILES.routes);
  const id = route.id || Math.random().toString(36).substr(2, 9);
  const now = new Date().toISOString();
  
  const routeWithId = { ...route, id, lastUpdateDate: now };
  const index = data.findIndex((r: any) => r.id === id);
  if (index > -1) {
    data[index] = routeWithId;
  } else {
    routeWithId.creationDate = now;
    data.push(routeWithId);
  }
  writeJSON(FILES.routes, data);
  return { success: true };
}

export async function deleteRoute(id: string) {
  const data = readJSON(FILES.routes).filter((r: any) => r.id !== id);
  writeJSON(FILES.routes, data);
  return { success: true };
}
