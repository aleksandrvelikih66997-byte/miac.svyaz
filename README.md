# МИАЦ.СВЯЗЬ (МИАЦ.АТС)

Профессиональный веб-интерфейс управления IP-АТС Asterisk для **AltLinux SP 10** и **Asterisk 17/20**.

## 🚀 Настройка Asterisk (ОБЯЗАТЕЛЬНО)

Для корректной работы системы необходимо связать основные конфигурационные файлы Asterisk с нашими генерируемыми файлами.

### 1. Настройка PJSIP (Абоненты и Транки)
Отредактируйте `/etc/asterisk/pjsip.conf`. В самом конце файла добавьте строки:
```ini
#include "/etc/asterisk/pjsip_miac_users.conf"
#include "/etc/asterisk/pjsip_miac_trunks.conf"
```

### 2. Настройка Очередей (Группы)
Отредактируйте `/etc/asterisk/queues.conf`. В самом конце добавьте:
```ini
#include "/etc/asterisk/queues_miac.conf"
```

### 3. Настройка Dialplan (Маршрутизация)
Отредактируйте `/etc/asterisk/extensions.conf`. В самом конце файла добавьте:
```ini
#include "/etc/asterisk/extensions_miac_dialplan.conf"
```

### 4. Настройка AMI (Manager)
Отредактируйте `/etc/asterisk/manager.conf`:
```ini
[general]
enabled = yes
port = 5038
bindaddr = 127.0.0.1

[miac]
secret = MiacAMI2026
read = all,system,command
write = all,system,command
```
После сохранения: `asterisk -rx "manager reload"`

### 5. Права доступа
Сделайте файлы доступными для записи системой:
```bash
touch /etc/asterisk/pjsip_miac_users.conf
touch /etc/asterisk/pjsip_miac_trunks.conf
touch /etc/asterisk/queues_miac.conf
touch /etc/asterisk/extensions_miac_dialplan.conf
chmod 666 /etc/asterisk/*.conf
```

### 6. Запуск системы
```bash
# В папке проекта
npm run bridge
```

## 🛠 Команды отладки
- `pjsip show endpoints` — список всех номеров и транков.
- `queue show` — проверка статуса очередей (групп).
- `dialplan show from-internal` — проверка внутренней маршрутизации.
- `pjsip show registrations` — проверка статуса регистрации транков у провайдера.
