
# МИАЦ.СВЯЗЬ (МИАЦ.АТС)

Профессиональный веб-интерфейс управления IP-АТС Asterisk для **AltLinux SP 10** и **Asterisk 17/20**.

## 🚀 Настройка Asterisk 17 (ОБЯЗАТЕЛЬНО)

Для того чтобы Asterisk увидел абонентов, созданных в панели, необходимо связать файлы.

### 1. Настройка PJSIP
Отредактируйте `/etc/asterisk/pjsip.conf`. В самом конце файла добавьте строку:
```ini
#include "/etc/asterisk/pjsip_miac_users.conf"
```
**Важно:** Убедитесь, что в `pjsip.conf` у вас есть транспорт с именем `[transport-udp-nat]`. Наша система будет использовать его.

### 2. Настройка AMI (Manager)
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
После сохранения: `asterisk -rx "manager reload"`

### 3. Права доступа
Сделайте файл доступным для записи веб-интерфейсом:
```bash
touch /etc/asterisk/pjsip_miac_users.conf
chmod 666 /etc/asterisk/pjsip_miac_users.conf
```

### 4. Запуск системы
```bash
# Перейдите в папку проекта
cd /etc/asterisk/miac.svyaz/

# Запуск моста (в фоне или отдельном терминале)
npm run bridge
```

## 🛠 Команды отладки
- `pjsip show endpoints` — список всех номеров.
- `pjsip show transports` — проверка доступности сети.
- `manager show connected` — проверка связи моста с астериском.
