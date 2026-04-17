
'use server';

import fs from 'fs';
import path from 'path';

export async function uploadAudioAction(formData: FormData) {
  try {
    const file = formData.get('audio') as File;
    if (!file) {
      return { success: false, error: 'Файл не найден' };
    }

    const ext = path.extname(file.name).toLowerCase();
    const validExtensions = ['.wav', '.mp3'];
    if (!validExtensions.includes(ext)) {
      return { success: false, error: 'Допустимы только файлы .wav или .mp3' };
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const soundsDir = path.join(process.cwd(), 'src/data/sounds');
    if (!fs.existsSync(soundsDir)) {
      fs.mkdirSync(soundsDir, { recursive: true });
    }

    const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase();
    const filePath = path.join(soundsDir, cleanName);
    
    fs.writeFileSync(filePath, buffer);
    
    // Устанавливаем права, чтобы Asterisk мог прочитать файл
    try {
      fs.chmodSync(filePath, 0o666);
    } catch (e) {}

    return { 
      success: true, 
      fileName: cleanName 
    };
  } catch (error: any) {
    console.error('Upload Error:', error);
    return { success: false, error: error.message };
  }
}
