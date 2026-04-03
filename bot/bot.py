import hashlib
import logging
import os
from dataclasses import dataclass
from pathlib import Path

from telegram import BotCommand, InlineKeyboardButton, InlineKeyboardMarkup, LabeledPrice, Update
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    PreCheckoutQueryHandler,
    filters,
)


logging.basicConfig(
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
)
logger = logging.getLogger("prompt-shop-bot")


BOT_TOKEN = os.environ["PROMPT_SHOP_BOT_TOKEN"]
BOT_DIR = Path(__file__).resolve().parent
PROMPTS_DIR = Path(os.getenv("PROMPTS_DIR", BOT_DIR / "prompts"))
PROMPT_PRICE_XTR = int(os.getenv("PROMPT_PRICE_XTR", "100"))

VISIBLE_EXTENSIONS = {
    ".md",
    ".txt",
    ".pdf",
    ".docx",
    ".zip",
    ".json",
}


@dataclass(frozen=True)
class PromptProduct:
    slug: str
    title: str
    description: str
    file_path: Path


def prompt_slug(file_path: Path) -> str:
    digest = hashlib.sha1(file_path.name.encode("utf-8")).hexdigest()
    return digest[:12]


def format_prompt_title(file_path: Path) -> str:
    raw_name = file_path.stem.replace("_", " ").replace("-", " ").strip()
    words = [part for part in raw_name.split() if part]
    if not words:
        return file_path.stem
    return " ".join(word.capitalize() for word in words)


def build_products() -> list[PromptProduct]:
    if not PROMPTS_DIR.exists():
        return []

    products: list[PromptProduct] = []
    for file_path in sorted(PROMPTS_DIR.iterdir(), key=lambda item: item.name.lower()):
        if not file_path.is_file():
            continue
        if file_path.suffix.lower() not in VISIBLE_EXTENSIONS:
            continue
        products.append(
            PromptProduct(
                slug=prompt_slug(file_path),
                title=format_prompt_title(file_path),
                description=f"Файл {file_path.name}. После оплаты бот сразу отправит его вам.",
                file_path=file_path,
            )
        )
    return products


def get_product_by_slug(slug: str) -> PromptProduct | None:
    for product in build_products():
        if product.slug == slug:
            return product
    return None


def build_shop_keyboard(products: list[PromptProduct]) -> InlineKeyboardMarkup:
    rows = [
        [
            InlineKeyboardButton(
                text=f"{product.title} • {PROMPT_PRICE_XTR} ⭐",
                callback_data=f"buy:{product.slug}",
            )
        ]
        for product in products
    ]
    return InlineKeyboardMarkup(rows)


def invoice_payload(product: PromptProduct) -> str:
    return f"prompt:{product.slug}"


async def post_init(application: Application) -> None:
    await application.bot.set_my_commands(
        [
            BotCommand("start", "Открыть магазин промптов"),
            BotCommand("shop", "Посмотреть промпты и купить за Stars"),
        ]
    )


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    message = update.effective_message
    if message is None:
        return

    await message.reply_text(
        "Привет. Я продаю AI-промпты за Telegram Stars.\n\n"
        "Команды:\n"
        "/shop — открыть магазин\n"
        "/start — показать это сообщение",
    )


async def shop_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    message = update.effective_message
    if message is None:
        return

    products = build_products()
    if not products:
        await message.reply_text(
            "В магазине пока нет файлов. Положите промпты в папку bot/prompts и попробуйте снова."
        )
        return

    product_lines = [
        f"{index}. {product.title} — {PROMPT_PRICE_XTR} ⭐"
        for index, product in enumerate(products, start=1)
    ]
    await message.reply_text(
        "Магазин промптов:\n\n"
        + "\n".join(product_lines)
        + "\n\nНажмите на нужный товар ниже.",
        reply_markup=build_shop_keyboard(products),
    )


async def buy_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if query is None or query.data is None:
        return

    await query.answer()

    _, _, slug = query.data.partition(":")
    product = get_product_by_slug(slug)
    if product is None:
        await query.message.reply_text("Этот товар не найден. Обновите /shop.")
        return

    await context.bot.send_invoice(
        chat_id=query.from_user.id,
        title=product.title[:32],
        description=product.description[:255],
        payload=invoice_payload(product),
        provider_token="",
        currency="XTR",
        prices=[LabeledPrice(product.title[:32], PROMPT_PRICE_XTR)],
        start_parameter=f"prompt-{product.slug}",
    )


async def precheckout_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.pre_checkout_query
    if query is None:
        return

    payload = query.invoice_payload
    prefix, _, slug = payload.partition(":")
    product = get_product_by_slug(slug) if prefix == "prompt" else None

    if product is None:
        await query.answer(ok=False, error_message="Товар не найден. Попробуйте открыть /shop снова.")
        return

    await query.answer(ok=True)


async def successful_payment_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    message = update.effective_message
    if message is None or message.successful_payment is None:
        return

    payload = message.successful_payment.invoice_payload
    prefix, _, slug = payload.partition(":")
    product = get_product_by_slug(slug) if prefix == "prompt" else None

    if product is None or not product.file_path.exists():
        logger.error("Paid product is missing for payload %s", payload)
        await message.reply_text(
            "Оплата прошла, но файл не найден. Напишите владельцу бота, чтобы он выдал покупку вручную."
        )
        return

    with product.file_path.open("rb") as document:
        await message.reply_document(
            document=document,
            filename=product.file_path.name,
            caption=f"Спасибо за покупку. Вот ваш файл: {product.title}",
        )


def main() -> None:
    application = Application.builder().token(BOT_TOKEN).post_init(post_init).build()

    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("shop", shop_command))
    application.add_handler(CallbackQueryHandler(buy_callback, pattern=r"^buy:"))
    application.add_handler(PreCheckoutQueryHandler(precheckout_callback))
    application.add_handler(
        MessageHandler(filters.SUCCESSFUL_PAYMENT, successful_payment_callback)
    )

    logger.info("Prompt shop bot started. Prompts dir: %s", PROMPTS_DIR)
    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
