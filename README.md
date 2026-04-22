
# МИАЦ.СВЯЗЬ (МИАЦ.АТС)

Профессиональный веб-интерфейс управления IP-АТС Asterisk для **AltLinux SP 10** и **Asterisk 17/20**.

## 🚀 Настройка Asterisk (ОБЯЗАТЕЛЬНО)

### 0. Установка необходимых модулей (AltLinux)
Если в логах появляется ошибка `No application 'Queue'`, установите и загрузите модули:
```bash
# Установка (если пакеты разделены)
apt-get install asterisk-queue asterisk-pjsip

# Проверка загрузки в консоли Asterisk
asterisk -rx "module load app_queue.so"
asterisk -rx "module load res_pjsip.so"
```

### 1. Настройка AMI и Очередей
Создайте файлы и установите права:
```bash
touch /etc/asterisk/queues.conf
echo '#include "queues_miac.conf"' > /etc/asterisk/queues.conf
touch /etc/asterisk/queuerules.conf
chmod 666 /etc/asterisk/*.conf
```

## ⚙️ Автозапуск (Systemd)

Для работы в фоновом режиме создайте два юнита в `/etc/systemd/system/`. 
**ВНИМАНИЕ:** Перед запуском сервисов остановите процессы, запущенные вручную (Ctrl+C), чтобы освободить порт 9002.

### 1. Веб-интерфейс (`miac-web.service`)
```ini
[Unit]
Description=MIAC Web Admin Panel
After=network.target asterisk.service

[Service]
Type=simple
User=root
WorkingDirectory=/etc/asterisk/miac.svyaz
ExecStart=/usr/bin/npm run dev
Restart=always
RestartSec=10
Environment=NODE_ENV=development
Environment=PATH=/usr/bin:/usr/local/bin

[Install]
WantedBy=multi-user.target
```

### 2. Мост с Asterisk (`miac-bridge.service`)
```ini
[Unit]
Description=MIAC Asterisk Bridge
After=network.target asterisk.service

[Service]
Type=simple
User=root
WorkingDirectory=/etc/asterisk/miac.svyaz
ExecStart=/usr/bin/npm run bridge
Restart=always
RestartSec=5
Environment=PATH=/usr/bin:/usr/local/bin

[Install]
WantedBy=multi-user.target
```

**Команды запуска:**
```bash
systemctl daemon-reload
systemctl enable miac-web
systemctl enable miac-bridge
systemctl restart miac-web
systemctl restart miac-bridge
```

## 🛠 Команды отладки
- `systemctl status miac-web` — статус веб-панели.
- `asterisk -rx "queue show"` — проверка работы групп.
- `journalctl -u miac-bridge -f` — логи моста в реальном времени.

---
*МИАЦ.СВЯЗЬ — Сделано для AltLinux SP 10*
