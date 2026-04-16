# АльтернаТИВ АТС — МИАЦ.СВЯЗЬ

Профессиональный веб-интерфейс управления IP-АТС Asterisk v17/20, оптимизированный для работы в среде **AltLinux SP**. 

Проект разработан специально для медицинских информационно-аналитических центров (МИАЦ) для централизованного и удобного управления телефонными сетями.

## 🚀 Основные возможности

- **Дашборд**: Мониторинг активных вызовов и статуса абонентов в реальном времени.
- **Управление абонентами**: Настройка PJSIP/SIP экстеншенов через удобный табличный интерфейс.
- **Маршрутизация**: Визуальное управление входящими и исходящие правилами набора.
- **Транки**: Конфигурация внешних линий связи с контролем статуса регистрации.
- **ИИ-Помощник**: Генерация конфигурационных файлов Asterisk на основе запросов на естественном языке (Genkit + Gemini).
- **Системный мониторинг**: Просмотр логов в реальном времени и управление службой `asterisk.service`.

## 🛠 Технологический стек

- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS.
- **UI Components**: ShadCN UI, Lucide Icons.
- **Backend/Auth**: Firebase (Authentication & Firestore).
- **AI**: Genkit 1.x, Google Gemini 2.5 Flash.

## 📦 Инструкция по развертыванию на AltLinux SP

### 1. Подготовка окружения
Убедитесь, что на сервере установлен Node.js версии 18 или выше:
```bash
node -v
```

### 2. Клонирование и установка
```bash
git clone https://github.com/aleksandrvelikih66997-byte/miac.svyaz.git
cd miac.svyaz
npm install
```

### 3. Сборка и запуск
```bash
# Сборка оптимизированного приложения
npm run build

# Запуск в фоновом режиме через PM2
npm install -g pm2
pm2 start npm --name "miac-svyaz" -- start
pm2 save
```

## 🌐 Настройка Apache (httpd2) как Reverse Proxy

Чтобы зайти в интерфейс по адресу сервера (порт 80), необходимо настроить проксирование запросов на порт 3000 (где работает Next.js).

1. **Создайте файл конфигурации для Apache**:
```bash
nano /etc/httpd2/conf.d/miac-svyaz.conf
```

2. **Вставьте следующее содержимое** (замените `your-server-ip` на IP вашего сервера):
```apache
<VirtualHost *:80>
    ServerName your-server-ip
    
    ProxyPreserveHost On
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/

    ErrorLog /var/log/httpd2/miac-svyaz-error.log
    CustomLog /var/log/httpd2/miac-svyaz-access.log combined
</VirtualHost>
```

3. **Включите необходимые модули и перезапустите Apache**:
Убедитесь, что в основном конфиге Apache (`/etc/httpd2/conf/httpd2.conf`) раскомментированы модули `proxy_module` и `proxy_http_module`.

```bash
systemctl restart httpd2
```

4. **Проверьте статус приложения в PM2**:
```bash
pm2 list
```

## 📄 Лицензия

Разработано для внутреннего использования в структурах МИАЦ.
