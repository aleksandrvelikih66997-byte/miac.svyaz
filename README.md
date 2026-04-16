
# МИАЦ.СВЯЗЬ (МИАЦ.АТС)

Профессиональный веб-интерфейс управления IP-АТС Asterisk для **AltLinux SP 10** и **Asterisk 17/20**.

## 🚀 Настройка Asterisk 17 (ОБЯЗАТЕЛЬНО)

Для того чтобы Asterisk увидел абонентов и маршруты, необходимо связать файлы.

### 1. Настройка PJSIP
Отредактируйте `/etc/asterisk/pjsip.conf`. В самом конце файла добавьте строку:
```ini
#include "/etc/asterisk/pjsip_miac_users.conf"
```
**Важно:** Убедитесь, что в `pjsip.conf` у вас есть транспорт с именем `[transport-udp-nat]`. Наша система использует его.

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
Сделайте файлы доступными для записи:
```bash
touch /etc/asterisk/pjsip_miac_users.conf
touch /etc/asterisk/extensions_miac_dialplan.conf
chmod 666 /etc/asterisk/pjsip_miac_users.conf
chmod 666 /etc/asterisk/extensions_miac_dialplan.conf
```

### 5. Запуск системы
```bash
# В папке проекта
npm run bridge
```

## 🛠 Команды отладки
- `pjsip show endpoints` — список всех номеров.
- `dialplan show from-internal` — проверка маршрутизации.
- `manager show connected` — проверка связи моста с астериском.
