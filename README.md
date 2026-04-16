
# МИАЦ.СВЯЗЬ (МИАЦ.АТС)

Профессиональный веб-интерфейс управления IP-АТС Asterisk 17/20 для **AltLinux SP 10**.

## 🚀 Настройка Asterisk на сервере

Для работы системы необходимо выполнить следующие шаги:

### 1. Настройка AMI (Manager Interface)
Отредактируйте `/etc/asterisk/manager.conf`:
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
touch /etc/asterisk/pjsip_miac_users.conf
chown asterisk:asterisk /etc/asterisk/pjsip_miac_users.conf
chmod 666 /etc/asterisk/pjsip_miac_users.conf
```

### 4. Запуск системы
```bash
# 1. Установка зависимостей
npm install

# 2. Создание админа (локально)
node src/scripts/setup-admin.mjs admin@miac.ru your_password

# 3. Запуск моста синхронизации
npm run bridge

# 4. Запуск веб-интерфейса
npm run build
npm start
```

## 🛡 Безопасность
Система работает в закрытом контуре. Все пароли SIP хранятся локально в `/etc/asterisk/pjsip_miac_users.conf`. Вход в веб-интерфейс осуществляется по локальной базе `src/data/admins.json`.
