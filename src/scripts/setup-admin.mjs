
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.log('Использование: node setup-admin.mjs <email> <password>');
  process.exit(1);
}

const ADMINS_FILE = path.join(process.cwd(), 'src/data/admins.json');
const DATA_DIR = path.join(process.cwd(), 'src/data');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function hashPassword(pass) {
  return crypto.createHash('sha256').update(pass).digest('hex');
}

let admins = [];
if (fs.existsSync(ADMINS_FILE)) {
  admins = JSON.parse(fs.readFileSync(ADMINS_FILE, 'utf8'));
}

const existing = admins.findIndex(a => a.email === email);
const adminData = {
  email,
  passwordHash: hashPassword(password),
  role: 'Admin',
  createdAt: new Date().toISOString()
};

if (existing > -1) admins[existing] = adminData;
else admins.push(adminData);

fs.writeFileSync(ADMINS_FILE, JSON.stringify(admins, null, 2));
console.log(`✅ Администратор ${email} успешно создан/обновлен.`);
