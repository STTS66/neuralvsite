import html
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import SplitResult, urlsplit, urlunsplit

import httpx
from telegram import BotCommand, Update
from telegram.constants import ChatType, ParseMode
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)


logging.basicConfig(
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
)
logger = logging.getLogger("telegram-support-bot")

BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
BACKEND_INTERNAL_URL = os.getenv(
    "BACKEND_INTERNAL_URL",
    "http://neuralv-backend:3000/api/internal/support",
).rstrip("/")
SUPPORT_INTERNAL_TOKEN = os.environ["SUPPORT_INTERNAL_TOKEN"]
POLL_INTERVAL_SECONDS = float(os.getenv("POLL_INTERVAL_SECONDS", "2"))


class SupportApi:
    def __init__(self) -> None:
        self.clients = [
            httpx.AsyncClient(
                base_url=base_url,
                headers={"x-internal-token": SUPPORT_INTERNAL_TOKEN},
                timeout=30.0,
                trust_env=False,
            )
            for base_url in build_backend_base_urls(BACKEND_INTERNAL_URL)
        ]
        self.active_client = self.clients[0]

    async def close(self) -> None:
        for client in self.clients:
            await client.aclose()

    async def request(self, method: str, url: str, **kwargs) -> httpx.Response:
        last_error: Exception | None = None
        ordered_clients = [self.active_client] + [
            client for client in self.clients if client is not self.active_client
        ]

        for client in ordered_clients:
            try:
                response = await client.request(method, url, **kwargs)
                if client is not self.active_client:
                    logger.warning("Switched support bot backend client to %s", client.base_url)
                    self.active_client = client
                return response
            except httpx.ConnectError as exc:
                last_error = exc
                logger.warning(
                    "Support bot failed to reach %s%s: %s",
                    client.base_url,
                    url,
                    exc,
                )

        if last_error:
            raise last_error
        raise RuntimeError("Support bot internal API request failed without a connection error")

    async def get_state(self) -> dict[str, Any]:
        response = await self.request("GET", "/state")
        response.raise_for_status()
        return response.json()

    async def set_settings(self, **settings: Any) -> dict[str, Any]:
        response = await self.request("POST", "/settings", json=settings)
        return response.json()

    async def fetch_outbox(self) -> list[dict[str, Any]]:
        response = await self.request("GET", "/outbox", params={"limit": 20})
        response.raise_for_status()
        data = response.json()
        return data.get("items", [])

    async def mark_delivered(
        self,
        message_id: int,
        telegram_chat_id: str,
        telegram_message_id: int,
        telegram_thread_id: str | None,
    ) -> None:
        response = await self.request(
            "POST",
            f"/outbox/{message_id}/delivered",
            json={
                "telegramChatId": telegram_chat_id,
                "telegramMessageId": telegram_message_id,
                "telegramThreadId": telegram_thread_id,
            },
        )
        response.raise_for_status()

    async def lookup_reply_target(
        self,
        chat_id: str,
        message_id: int,
    ) -> dict[str, Any] | None:
        response = await self.request(
            "GET",
            "/telegram-map",
            params={"chatId": chat_id, "messageId": message_id},
        )
        response.raise_for_status()
        return response.json().get("item")

    async def send_support_reply(
        self,
        conversation_id: int,
        text: str,
    ) -> dict[str, Any]:
        response = await self.request(
            "POST",
            "/reply",
            json={
                "conversationId": conversation_id,
                "text": text,
                "senderName": "Поддержка",
            },
        )
        return response.json()

    async def send_support_reply_media(
        self,
        conversation_id: int,
        text: str,
        content: bytes,
        filename: str,
        content_type: str,
    ) -> dict[str, Any]:
        response = await self.request(
            "POST",
            "/reply-media",
            data={
                "conversationId": str(conversation_id),
                "text": text,
                "senderName": "Поддержка",
            },
            files={
                "media": (filename, content, content_type),
            },
        )
        return response.json()


def replace_host(parsed_url: SplitResult, hostname: str) -> str:
    port = f":{parsed_url.port}" if parsed_url.port else ""
    return urlunsplit(
        (
            parsed_url.scheme,
            f"{hostname}{port}",
            parsed_url.path,
            parsed_url.query,
            parsed_url.fragment,
        )
    )


def build_backend_base_urls(base_url: str) -> list[str]:
    parsed_url = urlsplit(base_url)
    candidates: list[str] = []
    seen: set[str] = set()

    def add(candidate: str) -> None:
        normalized = candidate.rstrip("/")
        if normalized and normalized not in seen:
            seen.add(normalized)
            candidates.append(normalized)

    add(base_url)

    if parsed_url.hostname == "neuralv-backend":
        add(replace_host(parsed_url, "backend"))
    elif parsed_url.hostname == "backend":
        add(replace_host(parsed_url, "neuralv-backend"))
    elif parsed_url.hostname:
        add(replace_host(parsed_url, "backend"))
        add(replace_host(parsed_url, "neuralv-backend"))

    return candidates


def truncate(value: str, limit: int) -> str:
    if len(value) <= limit:
        return value
    return value[: limit - 3] + "..."


def format_timestamp(value: str) -> str:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).strftime(
            "%Y-%m-%d %H:%M:%S"
        )
    except ValueError:
        return value


def render_support_ticket(item: dict[str, Any]) -> str:
    text = html.escape(truncate(item["text"], 3200))
    display_name = html.escape(item.get("conversationDisplayName") or item["senderName"])
    public_id = html.escape(item["publicId"])
    website_user = html.escape(str(item["userId"])) if item.get("userId") else "Гость"

    return (
        "<b>Новый запрос поддержки</b>\n"
        f"<b>Диалог:</b> {public_id}\n"
        f"<b>Клиент:</b> {display_name}\n"
        f"<b>ID на сайте:</b> {website_user}\n"
        f"<b>Время:</b> {html.escape(format_timestamp(item['createdAt']))}\n\n"
        f"{text}\n\n"
        "<i>Ответьте реплаем на это сообщение, чтобы отправить ответ в диалог на сайте.</i>"
    )


def build_help_text() -> str:
    return (
        "Команды поддержки:\n"
        "/status - показать текущую настройку\n"
        "/setchat - привязать текущую группу для тикетов\n"
        "/settopic - привязать текущую тему форума"
    )


async def extract_media_payload(message) -> dict[str, Any] | None:
    if message.photo:
        photo = message.photo[-1]
        telegram_file = await photo.get_file()
        content = bytes(await telegram_file.download_as_bytearray())
        extension = Path(telegram_file.file_path or "").suffix or ".jpg"
        return {
            "content": content,
            "filename": f"support-photo-{message.message_id}{extension}",
            "content_type": "image/jpeg",
        }

    if message.document and (message.document.mime_type or "").startswith("image/"):
        telegram_file = await message.document.get_file()
        content = bytes(await telegram_file.download_as_bytearray())
        extension = Path(
            message.document.file_name or telegram_file.file_path or ""
        ).suffix or ".jpg"
        return {
            "content": content,
            "filename": f"support-image-{message.message_id}{extension}",
            "content_type": message.document.mime_type or "image/jpeg",
        }

    return None


async def get_api(context: ContextTypes.DEFAULT_TYPE) -> SupportApi:
    return context.application.bot_data["support_api"]


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.effective_message.reply_text(build_help_text())


async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    api = await get_api(context)
    state = await api.get_state()
    chat_id = state.get("supportChatId") or "не задан"
    topic_id = state.get("supportThreadId") or "не задана"

    await update.effective_message.reply_text(
        f"Группа: {chat_id}\n"
        f"Тема: {topic_id}\n"
        f"Задержка сообщений: {int(state.get('cooldownMs', 5000) / 1000)} сек"
    )


async def set_chat_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if update.effective_chat.type not in {ChatType.GROUP, ChatType.SUPERGROUP}:
        await update.effective_message.reply_text(
            "Команду /setchat нужно запускать внутри нужной группы."
        )
        return

    api = await get_api(context)
    result = await api.set_settings(supportChatId=str(update.effective_chat.id))

    if result.get("success"):
        await update.effective_message.reply_text(
            f"Группа поддержки сохранена: {update.effective_chat.id}"
        )
        return

    await update.effective_message.reply_text(
        result.get("message", "Не удалось сохранить группу.")
    )


async def set_topic_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    api = await get_api(context)
    thread_id = update.effective_message.message_thread_id
    result = await api.set_settings(
        supportThreadId=str(thread_id) if thread_id else None,
    )

    if result.get("success"):
        if thread_id:
            await update.effective_message.reply_text(
                f"Тема поддержки сохранена: {thread_id}"
            )
        else:
            await update.effective_message.reply_text(
                "Тема очищена. Новые тикеты будут идти в основной чат."
            )
        return

    await update.effective_message.reply_text(
        result.get("message", "Не удалось сохранить тему.")
    )


async def sync_outbox(context: ContextTypes.DEFAULT_TYPE) -> None:
    api = await get_api(context)

    try:
        state = await api.get_state()
        chat_id = state.get("supportChatId")
        thread_id = state.get("supportThreadId")
        if not chat_id:
            return

        items = await api.fetch_outbox()
        for item in items:
            message = await context.bot.send_message(
                chat_id=int(chat_id),
                message_thread_id=int(thread_id) if thread_id else None,
                text=render_support_ticket(item),
                parse_mode=ParseMode.HTML,
                disable_web_page_preview=True,
            )
            await api.mark_delivered(
                item["id"],
                str(chat_id),
                message.message_id,
                str(thread_id) if thread_id else None,
            )
    except Exception:
        logger.exception("Failed to sync support outbox")


async def reply_bridge(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    message = update.effective_message
    if not message or not message.reply_to_message:
        return

    api = await get_api(context)
    state = await api.get_state()

    if str(update.effective_chat.id) != str(state.get("supportChatId")):
        return

    target = await api.lookup_reply_target(
        str(update.effective_chat.id),
        message.reply_to_message.message_id,
    )
    if not target:
        return

    text = message.text or message.caption or ""
    media_payload = await extract_media_payload(message)

    if media_payload:
        result = await api.send_support_reply_media(
            target["conversationId"],
            text,
            media_payload["content"],
            media_payload["filename"],
            media_payload["content_type"],
        )
    elif text:
        result = await api.send_support_reply(
            target["conversationId"],
            text,
        )
    else:
        return

    if not result.get("success"):
        await message.reply_text(
            result.get("message", "Не удалось доставить ответ на сайт.")
        )


async def set_commands(application: Application) -> None:
    await application.bot.set_my_commands(
        [
            BotCommand("start", "Показать помощь"),
            BotCommand("status", "Показать статус поддержки"),
            BotCommand("setchat", "Сохранить текущую группу"),
            BotCommand("settopic", "Сохранить текущую тему"),
        ]
    )


async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    logger.exception("Unhandled bot error: %s", context.error)


async def post_shutdown(application: Application) -> None:
    api: SupportApi = application.bot_data["support_api"]
    await api.close()


def main() -> None:
    application = (
        Application.builder()
        .token(BOT_TOKEN)
        .post_init(set_commands)
        .post_shutdown(post_shutdown)
        .build()
    )
    application.bot_data["support_api"] = SupportApi()

    application.add_error_handler(error_handler)
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("status", status_command))
    application.add_handler(CommandHandler("setchat", set_chat_command))
    application.add_handler(CommandHandler("settopic", set_topic_command))
    application.add_handler(
        MessageHandler(
            (filters.TEXT | filters.PHOTO | filters.Document.IMAGE)
            & filters.REPLY
            & ~filters.COMMAND,
            reply_bridge,
        )
    )

    application.job_queue.run_repeating(
        sync_outbox,
        interval=POLL_INTERVAL_SECONDS,
        first=3,
    )
    application.run_polling(drop_pending_updates=False)


if __name__ == "__main__":
    main()
