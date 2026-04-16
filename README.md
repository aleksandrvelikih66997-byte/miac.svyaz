
# МИАЦ.СВЯЗЬ (МИАЦ.АТС)

Профессиональный веб-интерфейс управления IP-АТС Asterisk для **AltLinux SP 10** и **Asterisk 17/20**.

## 🚀 Быстрая настройка сервера

### 1. Подготовка AMI (ОБЯЗАТЕЛЬНО)
Создайте или отредактируйте `/etc/asterisk/manager.conf`:
```ini
[general]
enabled = yes
port = 5038
bindaddr = 0.0.0.0

[miac]
secret = MiacAMI2026
read = all
write = all
```
После создания выполните: `asterisk -rx "manager reload"`

### 2. Подготовка PJSIP
Добавьте в конец `/etc/asterisk/pjsip.conf` **абсолютный путь**:
```ini
#include "/etc/asterisk/pjsip_miac_users.conf"
```

### 3. Права доступа
Выполните команды под root:
```bash
# Создаем файл для абонентов
touch /etc/asterisk/pjsip_miac_users.conf

# Даем права на запись (чтобы node-скрипт мог писать в файл)
chmod 666 /etc/asterisk/pjsip_miac_users.conf
```

### 4. Запуск системы
```bash
# 1. Создание администратора (выполнять из папки проекта)
node src/scripts/setup-admin.mjs <ваш_email> <пароль>

# 2. Запуск моста синхронизации (в отдельном терминале/screen)
npm run bridge
```

### 5. Проверка работы
В консоли Asterisk (`asterisk -rvvv`):
- `pjsip show endpoints` — должны появиться созданные номера.
- `pjsip show transports` — должен быть виден `transport-udp`.
- `manager show connected` — должен быть виден пользователь `miac`.

## 🛡 Безопасность
Система работает в полностью **изолированном режиме (Closed Circuit)**.
- Хранение данных: Локальные JSON-файлы в `src/data/`.
- Авторизация: Локальная база администраторов.
- Сессия: HTTP-куки с `secure: false` для работы без HTTPS.
