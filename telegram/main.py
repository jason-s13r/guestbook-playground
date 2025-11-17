#!/usr/bin/env python3

import asyncio
import logging
import os
from datetime import datetime
from threading import Thread
from pathlib import Path
import subprocess
from telethon.tl.custom.button import Button
from telethon import TelegramClient, events
from flask import Flask, request, abort

logging.basicConfig(
    format="[%(asctime)s][%(levelname)s][%(name)s:%(lineno)s %(funcName)s()] %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

API_ID = int(os.getenv("API_ID", 0))
API_HASH = os.getenv("API_HASH", "")
BOT_TOKEN = os.getenv("BOT_TOKEN", "")
CHAT_ID = int(os.getenv("CHAT_ID", 0))
OWNER_NAME = os.getenv("OWNER_NAME", "qot")
PORT = int(os.getenv("PORT", 5000))
REPO_CLONE_URL = os.getenv("REPO_CLONE_URL", "")

URL = "/"

FORM_TEXT = f"""<pre>
<form action="{URL}" method="POST" accept-charset="UTF-8">
<input name="name" style="border: none; height: 0.1em" />
Name: <input name="from" />
Url (optional): <input name="url" />
Message:
<textarea name="message" cols="60" rows="18"></textarea>
CAPTCHA: Who owns this site? <input name="captcha" />
<button type="submit">Submit</button>
</form>
</pre>
"""

# Initialize Flask app globally
api = Flask(__name__)

# Global bot instance
bot = None
loop = None


@api.route("/", methods=["GET"])
def nah():
    return FORM_TEXT


@api.route("/", methods=["POST"])
def submission():
    trap = request.form.get("name", None)
    if trap:
        return "Thanks! Your message is pending approval."

    captcha = request.form.get("captcha", None)
    if not captcha or OWNER_NAME not in captcha.lower():
        return "Please solve the CAPTCHA correctly."

    name = request.form.get("from", None)
    message = request.form.get("message", None)
    url = request.form.get("url", "")

    if not name:
        return abort(400, "Please provide a name.")
    if not message:
        return abort(400, "Please provide a message.")

    if url and not url.startswith("http"):
        url = "https://" + url

    date = datetime.now()
    day = date.strftime("%Y-%m-%d")
    link = "" if not url else f'(<a href="{url}">{url}</a>)'

    label = f"{day}-submission"
    header = f"{day} - {name} {link}".strip()
    submission_text = f"\n{header}\n\n{message}\n\n"

    # Schedule the async task in the bot's event loop
    asyncio.run_coroutine_threadsafe(send_to_telegram(submission_text, label), loop)

    return "Thanks! Your message is pending approval."


async def send_to_telegram(submission_text, label):
    """Async function to send message to Telegram"""
    try:
        file = await bot.upload_file(
            file=submission_text.encode("utf-8"), file_name=f"{label}.html"
        )
        reply = await bot.send_message(CHAT_ID, submission_text, file=file)
        markup = bot.build_reply_markup(
            [
                [Button.inline("Approve", data="approve:" + str(reply.id))],
                [Button.inline("Decline", data="decline:" + str(reply.id))],
            ]
        )
        await reply.edit(buttons=markup)
        logger.info(f"Sent submission to Telegram: {label}")
    except Exception as e:
        logger.error(f"Error sending to Telegram: {e}")


async def start_bot():
    """Start the Telethon bot"""
    global bot, loop

    loop = asyncio.get_event_loop()
    bot = TelegramClient("guestbook", API_ID, API_HASH, loop=loop)

    await bot.start(bot_token=BOT_TOKEN)
    logger.info("Bot started successfully")

    # You can add event handlers here if needed
    @bot.on(events.CallbackQuery)
    async def callback_handler(event):
        data = event.data.decode("utf-8")
        action, msg_id = data.split(":", 1)

        if action == "decline":
            await bot.delete_messages(CHAT_ID, msg_id)
            return
        
        [msg] = await bot.get_messages(CHAT_ID, ids=[int(msg_id)])

        file = await msg.download_media()
        tmp = subprocess.run(['mktemp', '-d'], capture_output=True).stdout.decode('utf-8').strip()

        print(tmp)
        print(str(tmp))
        entries = Path(tmp) / "entries"
        print(entries)

        subprocess.run(["ls", str(entries)])
        
        subprocess.run(["git", "clone", REPO_CLONE_URL, "."], cwd=tmp)
        subprocess.run(["mv", file, entries])
        subprocess.run(["git", "add", "."], cwd=tmp)
        subprocess.run(["git", "config", "user.name", "guestbook-bot"], cwd=tmp)
        subprocess.run(["git", "config", "user.email", "bot@guestbook.1j.nz"], cwd=tmp)
        subprocess.run(["git", "commit", "-m", f"guestbook entry: {msg_id}"], cwd=tmp)
        subprocess.run(["git", "push"], cwd=tmp)

        await msg.reply("ok")


    await bot.run_until_disconnected()


def run_flask():
    """Run Flask in a separate thread"""
    api.run(host="0.0.0.0", port=PORT, debug=False, use_reloader=False)


if __name__ == "__main__":
    # Start Flask in a background thread
    flask_thread = Thread(target=run_flask, daemon=True)
    flask_thread.start()
    logger.info(f"Flask started on port {PORT}")

    # Run Telethon bot in the main thread
    asyncio.run(start_bot())
