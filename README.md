
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
**Важно:** Убедитесь, что в `pjsip.conf` у вас есть транспорт с именем `[transport-udp-nat]`. Система использует именно это имя.

### 2. Настройка Dialplan (Маршрутизация)
Отредактируйте `/etc/asterisk/extensions.conf`. В самом конце файла добавьте:
```ini
#include "/etc/asterisk/extensions_miac_dialplan.conf"
```

### 3. Настройка AMI (Manager)
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

### 4. Права доступа
Сделайте файлы доступными для записи системой:
```bash
touch /etc/asterisk/pjsip_miac_users.conf
touch /etc/asterisk/pjsip_miac_trunks.conf
touch /etc/asterisk/extensions_miac_dialplan.conf
chmod 666 /etc/asterisk/pjsip_miac_users.conf
chmod 666 /etc/asterisk/pjsip_miac_trunks.conf
chmod 666 /etc/asterisk/extensions_miac_dialplan.conf
```

### 5. Запуск системы
```bash
# В папке проекта
npm run bridge
```

## 🛠 Команды отладки
- `pjsip show endpoints` — список всех номеров и транков.
- `pjsip show registrations` — статус регистрации внешних транков.
- `dialplan show from-internal` — проверка внутренней маршрутизации.
- `dialplan show from-trunk` — проверка входящей маршрутизации.
