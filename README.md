
# МИАЦ.СВЯЗЬ (МИАЦ.АТС)

Профессиональный веб-интерфейс управления IP-АТС Asterisk 17/20 для **AltLinux SP 10**.

## 🚀 Настройка Asterisk на сервере

Для работы системы необходимо выполнить следующие шаги:

### 1. Настройка AMI (Manager Interface)
Если файла `/etc/asterisk/manager.conf` нет, создайте его:
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

### 2. Подключение конфига абонентов
Добавьте в конец файла `/etc/asterisk/pjsip.conf`:
```ini
#include pjsip_miac_users.conf
```

### 3. Права доступа и подготовка
Если `chown asterisk:asterisk` выдает ошибку, значит в вашей системе другой пользователь. Самый надежный способ для работы скрипта:
```bash
# Создаем файл для абонентов
touch /etc/asterisk/pjsip_miac_users.conf

# Назначаем полные права на этот файл, чтобы скрипт синхронизации мог в него писать
chmod 666 /etc/asterisk/pjsip_miac_users.conf
```

### 4. Запуск системы
```bash
# 1. Установка зависимостей
npm install

# 2. Создание админа (локально)
# Пример: node src/scripts/setup-admin.mjs admin@miac.ru your_password
node src/scripts/setup-admin.mjs <email> <password>

# 3. Запуск моста синхронизации (в фоне или отдельном терминале)
# Этот процесс должен работать постоянно для применения настроек
npm run bridge

# 4. Запуск веб-интерфейса
npm run build
npm start
```

## 🛡 Безопасность
Система работает в закрытом контуре. Все пароли SIP хранятся локально в `/etc/asterisk/pjsip_miac_users.conf`. Вход в веб-интерфейс осуществляется по локальной базе `src/data/admins.json`.
