'use server';

import fs from 'fs';
import path from 'path';

/**
 * Server Action для загрузки аудиофайлов IVR.
 * Сохраняет файлы в директорию src/data/sounds.
 */
export async function uploadAudioAction(formData: FormData) {
  try {
    const file = formData.get('audio') as File;
    if (!file) {
      return { success: false, error: 'Файл не найден' };
    }

    // Проверка типа файла
    const validExtensions = ['.wav', '.mp3', '.gsm'];
    const ext = path.extname(file.name).toLowerCase();
    if (!validExtensions.includes(ext)) {
      return { success: false, error: 'Допустимы только файлы .wav или .mp3' };
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const soundsDir = path.join(process.cwd(), 'src/data/sounds');
    if (!fs.existsSync(soundsDir)) {
      fs.mkdirSync(soundsDir, { recursive: true });
    }

    // Очистка имени файла от спецсимволов и пробелов
    const cleanName = file.name
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .toLowerCase();
    
    const filePath = path.join(soundsDir, cleanName);
    
    fs.writeFileSync(filePath, buffer);
    
    // Пытаемся установить права, чтобы Asterisk мог прочитать файл после синхронизации
    try {
      fs.chmodSync(filePath, 0o666);
    } catch (e) {
      console.warn('Could not change permissions for file', filePath);
    }

    return { 
      success: true, 
      fileName: cleanName,
      path: filePath 
    };
  } catch (error: any) {
    console.error('Upload Error:', error);
    return { success: false, error: `Системная ошибка: ${error.message}` };
  }
}
