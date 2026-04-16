
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
```bash
# Перейдите в папку с проектом
cd /etc/asterisk/miac.svyaz

# Создаем файл для абонентов
touch /etc/asterisk/pjsip_miac_users.conf

# Назначаем полные права на этот файл, чтобы скрипт синхронизации мог в него писать
chmod 666 /etc/asterisk/pjsip_miac_users.conf
```

### 4. Запуск системы
```bash
# 1. Установка зависимостей (выполняется один раз)
npm install

# 2. Создание админа (локально)
# Важно: запускать из корневой папки проекта!
node src/scripts/setup-admin.mjs admin@miac.ru your_password

# 3. Запуск моста синхронизации
# Этот процесс должен работать постоянно!
npm run bridge

# 4. Запуск веб-интерфейса (в другом терминале)
npm run build
npm start
```

## 🛡 Безопасность
Система работает в закрытом контуре. Все пароли SIP хранятся локально в `/etc/asterisk/pjsip_miac_users.conf`. Вход в веб-интерфейс осуществляется по локальной базе `src/data/admins.json`.
