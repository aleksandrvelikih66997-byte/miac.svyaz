
# МИАЦ.СВЯЗЬ (МИАЦ.АТС)

Профессиональный веб-интерфейс управления IP-АТС Asterisk для **AltLinux SP 10** и **Asterisk 17/20**.

## 🚀 Быстрая настройка сервера

### 1. Подготовка AMI (ОБЯЗАТЕЛЬНО)
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
После создания выполните: `asterisk -rx "manager reload"`

### 2. Подготовка PJSIP
Добавьте в конец `/etc/asterisk/pjsip.conf`:
```ini
#include pjsip_miac_users.conf
```

### 3. Права доступа
Выполните команды в консоли сервера:
```bash
# Создаем пустой файл абонентов
touch /etc/asterisk/pjsip_miac_users.conf

# Даем права на запись (666 для работы скрипта от любого пользователя)
chmod 666 /etc/asterisk/pjsip_miac_users.conf
```

### 4. Запуск системы (в папке проекта)
```bash
# 1. Создание администратора
node src/scripts/setup-admin.mjs <ваш_email> <пароль>

# 2. Сборка и запуск веб-интерфейса
npm run build
npm start

# 3. Запуск моста синхронизации (в отдельном терминале/screen)
npm run bridge
```

## 🛡 Безопасность
Система работает в полностью **изолированном режиме (Closed Circuit)**.
- Хранение данных: Локальные JSON-файлы в `src/data/`.
- Авторизация: Локальная база администраторов.
- Сессия: HTTP-куки с отключенным флагом Secure (для работы без SSL/HTTPS).
