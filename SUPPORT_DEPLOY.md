# Telegram Support Setup

## 1. Prepare environment

1. Copy `.env.example` to `.env`
2. Fill in `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
3. Fill in `TELEGRAM_BOT_TOKEN`
4. Fill in `SUPPORT_INTERNAL_TOKEN` with a long random string
5. Change `DEFAULT_ADMIN_PASSWORD`

## 2. Build and start

```bash
docker compose up -d --build
```

## 3. See logs

```bash
docker compose logs -f frontend
docker compose logs -f backend
docker compose logs -f telegram-bot
```

## 4. First bot setup in Telegram

1. Add the bot into your forum group with topics enabled
2. In the target group run `/setchat`
3. Open the needed topic and run `/settopic`
## 5. How replies work

1. User writes in the site dialog
2. Bot forwards the message into the configured group/topic
3. Support replies to that message with Telegram reply
4. The reply appears inside the site dialog as a support message
