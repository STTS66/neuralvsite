import html
import logging
import os
from datetime import datetime
from urllib.parse import quote

import httpx
from telegram import BotCommand, InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.constants import ChatType, ParseMode
from telegram.ext import Application, CommandHandler, ContextTypes


logging.basicConfig(
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
)
logger = logging.getLogger("telegram-admin-bot")

BOT_TOKEN = os.environ["ADMIN_NOTIFY_BOT_TOKEN"]
BACKEND_INTERNAL_URL = os.getenv(
    "BACKEND_INTERNAL_URL",
    "http://neuralv-backend:3000/api/internal/admin",
).rstrip("/")
SUPPORT_INTERNAL_TOKEN = os.environ["SUPPORT_INTERNAL_TOKEN"]
POLL_INTERVAL_SECONDS = float(os.getenv("ADMIN_NOTIFY_POLL_INTERVAL_SECONDS", "5"))
ADMIN_PANEL_URL = os.getenv("ADMIN_PANEL_URL", "").strip()
ADMIN_NOTIFY_CHAT_IDS = [
    value.strip()
    for value in os.getenv("ADMIN_NOTIFY_CHAT_IDS", "").split(",")
    if value.strip()
]


class AdminNotifyApi:
    def __init__(self) -> None:
        self.client = httpx.AsyncClient(
            base_url=BACKEND_INTERNAL_URL,
            headers={"x-internal-token": SUPPORT_INTERNAL_TOKEN},
            timeout=20.0,
        )

    async def close(self) -> None:
        await self.client.aclose()

    async def get_state(self) -> dict:
        response = await self.client.get("/state")
        response.raise_for_status()
        return response.json()

    async def set_settings(self, **settings: str | None) -> dict:
        response = await self.client.post("/settings", json=settings)
        response.raise_for_status()
        return response.json()

    async def fetch_outbox(self) -> list[dict]:
        response = await self.client.get("/orders/outbox", params={"limit": 20})
        response.raise_for_status()
        return response.json().get("items", [])

    async def mark_delivered(self, order_id: int) -> None:
        response = await self.client.post(f"/orders/{order_id}/delivered")
        response.raise_for_status()


def format_timestamp(value: str) -> str:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).strftime(
            "%Y-%m-%d %H:%M:%S"
        )
    except ValueError:
        return value


def build_admin_url(account_id: str | None) -> str | None:
    if not ADMIN_PANEL_URL:
        return None

    if account_id:
        separator = "&" if "?" in ADMIN_PANEL_URL else "?"
        return f"{ADMIN_PANEL_URL}{separator}accountId={quote(account_id)}"

    return ADMIN_PANEL_URL


def render_order_text(item: dict) -> str:
    parts = [
        "<b>Новая заявка на проверку</b>",
        f"<b>Заявка:</b> #{item['id']}",
    ]

    if item.get("accountId"):
        parts.append(f"<b>Account ID:</b> {html.escape(item['accountId'])}")

    parts.append(f"<b>Пользователь:</b> {html.escape(item.get('username') or 'Unknown')}")

    if item.get("email"):
        parts.append(f"<b>Email:</b> {html.escape(item['email'])}")

    parts.append(f"<b>Время:</b> {html.escape(format_timestamp(item['createdAt']))}")

    if item.get("link"):
        parts.append("")
        parts.append(f"<b>Ссылка:</b> {html.escape(item['link'])}")
    elif item.get("hasFile"):
        parts.append("")
        parts.append("<b>Файл:</b> Пользователь прикрепил файл")

    parts.append("")
    parts.append("Открой админ-панель, чтобы посмотреть профиль и обработать заявку.")
    return "\n".join(parts)


def build_keyboard(item: dict) -> InlineKeyboardMarkup | None:
    admin_url = build_admin_url(item.get("accountId"))
    if not admin_url:
        return None

    return InlineKeyboardMarkup(
        [[InlineKeyboardButton(text="Открыть профиль", url=admin_url)]]
    )


def build_help_text() -> str:
    return (
        "Команды admin-бота:\n"
        "/status - показать текущую настройку\n"
        "/setchat - привязать текущую группу для уведомлений\n"
        "/settopic - привязать текущую тему форума"
    )


async def get_api(context: ContextTypes.DEFAULT_TYPE) -> AdminNotifyApi:
    return context.application.bot_data["admin_notify_api"]


async def start_command(update: Update, _context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.effective_message.reply_text(build_help_text())


async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    api = await get_api(context)
    state = await api.get_state()
    chat_id = state.get("adminNotifyChatId") or "не задан"
    topic_id = state.get("adminNotifyThreadId") or "не задана"
    direct_ids = ", ".join(ADMIN_NOTIFY_CHAT_IDS) if ADMIN_NOTIFY_CHAT_IDS else "не заданы"

    await update.effective_message.reply_text(
        f"Группа: {chat_id}\n"
        f"Тема: {topic_id}\n"
        f"Резервные direct ID: {direct_ids}\n"
        f"Ссылка на админку: {ADMIN_PANEL_URL or 'не задана'}"
    )


async def set_chat_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if update.effective_chat.type not in {ChatType.GROUP, ChatType.SUPERGROUP}:
        await update.effective_message.reply_text(
            "Команду /setchat нужно запускать внутри нужной группы."
        )
        return

    api = await get_api(context)
    result = await api.set_settings(adminNotifyChatId=str(update.effective_chat.id))

    if result.get("success"):
        await update.effective_message.reply_text(
            f"Группа уведомлений сохранена: {update.effective_chat.id}"
        )
        return

    await update.effective_message.reply_text(
        result.get("message", "Не удалось сохранить группу уведомлений.")
    )


async def set_topic_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    api = await get_api(context)
    thread_id = update.effective_message.message_thread_id
    result = await api.set_settings(
        adminNotifyThreadId=str(thread_id) if thread_id else None,
    )

    if result.get("success"):
        if thread_id:
            await update.effective_message.reply_text(
                f"Тема уведомлений сохранена: {thread_id}"
            )
        else:
            await update.effective_message.reply_text(
                "Тема очищена. Уведомления будут идти в основной чат."
            )
        return

    await update.effective_message.reply_text(
        result.get("message", "Не удалось сохранить тему уведомлений.")
    )


async def sync_outbox(context: ContextTypes.DEFAULT_TYPE) -> None:
    api = await get_api(context)

    try:
        state = await api.get_state()
        chat_id = state.get("adminNotifyChatId")
        thread_id = state.get("adminNotifyThreadId")
        items = await api.fetch_outbox()

        for item in items:
            keyboard = build_keyboard(item)

            if chat_id:
                await context.bot.send_message(
                    chat_id=int(chat_id),
                    message_thread_id=int(thread_id) if thread_id else None,
                    text=render_order_text(item),
                    reply_markup=keyboard,
                    disable_web_page_preview=True,
                    parse_mode=ParseMode.HTML,
                )
            else:
                if not ADMIN_NOTIFY_CHAT_IDS:
                    continue

                for target_chat_id in ADMIN_NOTIFY_CHAT_IDS:
                    await context.bot.send_message(
                        chat_id=int(target_chat_id),
                        text=render_order_text(item),
                        reply_markup=keyboard,
                        disable_web_page_preview=True,
                        parse_mode=ParseMode.HTML,
                    )

            await api.mark_delivered(item["id"])
    except Exception:
        logger.exception("Failed to sync admin notifications outbox")


async def set_commands(application: Application) -> None:
    await application.bot.set_my_commands(
        [
            BotCommand("start", "Показать помощь"),
            BotCommand("status", "Показать статус уведомлений"),
            BotCommand("setchat", "Сохранить текущую группу"),
            BotCommand("settopic", "Сохранить текущую тему"),
        ]
    )


async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    logger.exception("Unhandled bot error: %s", context.error)


async def post_shutdown(application: Application) -> None:
    api: AdminNotifyApi = application.bot_data["admin_notify_api"]
    await api.close()


def main() -> None:
    application = (
        Application.builder()
        .token(BOT_TOKEN)
        .post_init(set_commands)
        .post_shutdown(post_shutdown)
        .build()
    )
    application.bot_data["admin_notify_api"] = AdminNotifyApi()

    application.add_error_handler(error_handler)
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("status", status_command))
    application.add_handler(CommandHandler("setchat", set_chat_command))
    application.add_handler(CommandHandler("settopic", set_topic_command))

    application.job_queue.run_repeating(
        sync_outbox,
        interval=POLL_INTERVAL_SECONDS,
        first=3,
    )
    application.run_polling(drop_pending_updates=False)


if __name__ == "__main__":
    main()
