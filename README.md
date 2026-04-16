
# МИАЦ.СВЯЗЬ (МИАЦ.АТС)

Профессиональный веб-интерфейс управления IP-АТС Asterisk 20 для **AltLinux SP 10**.

## 🚀 Быстрый старт на сервере

### 1. Подготовка и установка
```bash
git pull origin main
npm install
```

### 2. Создание первого администратора
Выполните команду в консоли сервера, чтобы задать логин и пароль для входа в веб-панель:
```bash
node src/scripts/setup-admin.mjs admin@miac.ru myPassword123
```

### 3. Запуск автоматической синхронизации (Bridge)
Запустите мост, который будет автоматически применять настройки из веба в Asterisk и обновлять статусы:
```bash
npm run bridge
```

## 🛠 Настройка прав Asterisk
Чтобы Bridge мог управлять Asterisk, убедитесь, что у него есть доступ к сокету и файлам:
```bash
# Доступ к сокету управления
chown -R asterisk:asterisk /var/run/asterisk
chmod 770 /var/run/asterisk/asterisk.ctl

# Доступ к конфигурационным файлам
chown -R asterisk:asterisk /etc/asterisk
chmod 775 /etc/asterisk
```

## 🛡 Безопасность
Система работает в закрытом контуре. Все пароли SIP хранятся локально на вашем сервере в `/etc/asterisk/pjsip_miac_users.conf`. Доступ к панели разрешен только пользователям, созданным через консольный скрипт `setup-admin.mjs`.
