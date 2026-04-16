# МИАЦ.СВЯЗЬ

Профессиональный веб-интерфейс управления IP-АТС Asterisk v17/20, оптимизированный для работы в среде **AltLinux SP**. 

## 🚀 Быстрый старт на AltLinux SP

### 1. Подготовка окружения
```bash
git clone https://github.com/aleksandrvelikih66997-byte/miac.svyaz.git
cd miac.svyaz
npm install
npm run build
pm2 start npm --name "miac-svyaz" -- start
```

### 2. Запуск и настройка Asterisk
Если вы видите ошибку `Unable to connect to remote asterisk`, это значит, что служба остановлена. Выполните:

```bash
# Включить и запустить службу
systemctl enable asterisk
systemctl start asterisk

# Проверить наличие сокета
ls -l /var/run/asterisk/asterisk.ctl

# Исправить права (если файл есть, но нет доступа)
chown -R asterisk:asterisk /var/run/asterisk
chmod 770 /var/run/asterisk/asterisk.ctl
```

### 3. Синхронизация данных
1. Добавьте абонентов в веб-интерфейсе.
2. Перейдите в раздел **Управление**.
3. Скачайте файл **PJSIP Абоненты**.
4. Поместите его в `/etc/asterisk/pjsip_miac_users.conf`.
5. Примените настройки: `asterisk -rx "core reload"`.

## 🛠 Технологический стек
- **Frontend**: Next.js 15, React 19.
- **Backend/Auth**: Firebase (Authentication & Firestore).
- **AI**: Genkit 1.x, Google Gemini 2.5 Flash.

## 📄 Безопасность
Проект разработан с учетом требований ФСТЭК: все конфигурационные файлы хранятся локально, а веб-интерфейс служит лишь инструментом генерации и управления базой данных.
