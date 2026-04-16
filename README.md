# МИАЦ.СВЯЗЬ (МИАЦ.АТС)

Профессиональный веб-интерфейс управления IP-АТС Asterisk для **AltLinux SP 10**.
Система работает полностью автономно (Closed Circuit) и использует локальное JSON-хранилище.

## 🚀 Быстрая настройка

### 1. Подготовка Asterisk
Создайте файл `/etc/asterisk/manager.conf`:
```ini
[general]
enabled = yes
port = 5038
bindaddr = 127.0.0.1

[miac]
secret = MiacAMI2026
read = all
write = all
```

Добавьте в конец `/etc/asterisk/pjsip.conf`:
```ini
#include pjsip_miac_users.conf
```

### 2. Права доступа (в корне проекта)
```bash
# Создаем пустой файл абонентов
touch /etc/asterisk/pjsip_miac_users.conf

# Даем права на запись (чтобы веб-интерфейс мог сохранять данные)
chmod 666 /etc/asterisk/pjsip_miac_users.conf
```

### 3. Установка и запуск
```bash
# 1. Установка зависимостей
npm install

# 2. Создание администратора панели управления
node src/scripts/setup-admin.mjs admin@miac.ru myPassword123

# 3. Сборка и запуск веб-интерфейса
npm run build
npm start

# 4. Запуск моста синхронизации (в отдельном терминале/screen)
npm run bridge
```

## 🛡 Безопасность
Система не требует интернета. Все данные хранятся в `src/data/`. Авторизация выполняется по локальной базе администраторов.
