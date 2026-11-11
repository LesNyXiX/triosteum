# Запуск Triosteum на своём сервере

Подробная пошаговая инструкция — в документе «Triosteum: запуск в Yandex Cloud» (https://claude.ai/artifact/5XNsCiUF6Mkrjr8b9bqr9U). Здесь коротко.

**Нужно:** сервер с Ubuntu 22.04/24.04 (от 2 vCPU и 4 ГБ памяти, диск 40 ГБ), домен, A-запись которого указывает на IP сервера, и открытые порты 80 и 443.

```bash
sudo git clone https://github.com/LesNyXiX/triosteum /opt/triosteum
cd /opt/triosteum
sudo bash deploy/install.sh --domain triosteum.example.ru --email admin@example.ru
```

Установщик ставит Docker, настраивает зеркало образов (Docker Hub ограничивает доступ из России), создаёт `.env` со случайными паролями, включает брандмауэр (открыты только 22, 80, 443), запускает Triosteum с HTTPS (Caddy сам получает сертификат Let's Encrypt) и включает ежедневную резервную копию базы. Сначала можно запустить с флагом `--dry-run`: тогда установщик только подготовит `.env` и покажет, что сделает.

| Действие | Команда |
|---|---|
| Обновить до последней версии | `sudo bash deploy/update.sh` (перед обновлением делается копия базы) |
| Резервная копия вручную | `sudo bash deploy/backup.sh` → `backups/` |
| Восстановить из копии | `sudo bash deploy/restore.sh backups/triosteum-….dump` |
| Журнал сервера | `sudo docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml logs -f api` |
| Применить изменения в `.env` | `sudo docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d` |

Почта, ИИ и лимиты настраиваются в `.env` (описание — в `.env.example` и `server/README.md`).

Если зеркало образов недоступно, в `.env` можно указать другие адреса образов: `POSTGRES_IMAGE`, `PYTHON_IMAGE`, `CADDY_IMAGE`, `OLLAMA_IMAGE`.

**Infinitum — собственный ИИ Triosteum.** Включается одной командой на сервере:

```bash
cd /opt/triosteum && sudo bash deploy/infinitum.sh
```

Скрипт подбирает модель под память сервера (2 ядра и 4 ГБ — `qwen2.5:1.5b`, 16 ГБ — `qwen2.5-coder:7b`, больше — крупнее),
при нехватке памяти добавляет файл подкачки, запускает Ollama, скачивает модель и проверяет ответ. Свою модель: `--model qwen2.5:3b`;
выключить: `--off`. После этого у всех пользователей сервера в переключателе ИИ в шапке работает «Infinitum» —
без ключей и установки, данные не уходят сторонним сервисам. Без видеокарты модель отвечает медленно и годится для
простых вопросов и коротких блоков кода; для серьёзной работы нужен сервер мощнее.
