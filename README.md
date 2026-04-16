
# МИАЦ.СВЯЗЬ (МИАЦ.АТС)

Профессиональный веб-интерфейс управления IP-АТС Asterisk для **AltLinux SP 10** и **Asterisk 17/20**.

## 🚀 Быстрая настройка сервера

### 1. Подготовка AMI (ОБЯЗАТЕЛЬНО)
Создайте файл `/etc/asterisk/manager.conf`:
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
Добавьте в конец `/etc/asterisk/pjsip.conf`:
```ini
#include pjsip_miac_users.conf
```

**ВАЖНО для Asterisk 17:** 
Убедитесь, что модуль PJSIP загружен. Проверьте в `asterisk -rx "module show like pjsip"`. 
Если список пуст, добавьте в `/etc/asterisk/modules.conf`:
```ini
load => res_pjsip.so
load => res_pjsip_session.so
load => res_pjsip_authenticator_digest.so
load => res_pjsip_registrar.so
load => res_pjsip_endpoint_identifier_user.so
```

### 3. Права доступа
Выполните команды в консоли сервера (из папки проекта):
```bash
# Создаем файл для абонентов
touch /etc/asterisk/pjsip_miac_users.conf

# Даем права на запись (666 для работы скрипта без root)
chmod 666 /etc/asterisk/pjsip_miac_users.conf
```

### 4. Запуск системы
```bash
# 1. Создание администратора
node src/scripts/setup-admin.mjs <ваш_email> <пароль>

# 2. Сборка и запуск веб-интерфейса
npm run build
npm start

# 3. Запуск моста синхронизации (в отдельном терминале/screen)
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
