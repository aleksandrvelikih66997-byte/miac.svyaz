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

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const soundsDir = path.join(process.cwd(), 'src/data/sounds');
    if (!fs.existsSync(soundsDir)) {
      fs.mkdirSync(soundsDir, { recursive: true });
    }

    // Очистка имени файла
    const fileName = file.name.replace(/\s+/g, '_').toLowerCase();
    const filePath = path.join(soundsDir, fileName);
    
    fs.writeFileSync(filePath, buffer);
    fs.chmodSync(filePath, 0o666);

    return { 
      success: true, 
      fileName: fileName,
      path: filePath 
    };
  } catch (error: any) {
    console.error('Upload Error:', error);
    return { success: false, error: error.message };
  }
}
