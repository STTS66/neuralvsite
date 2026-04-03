FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1
ENV PIP_DEFAULT_TIMEOUT=120

COPY requirements.txt ./
RUN python -m pip install --no-cache-dir --retries 10 --timeout 120 -r requirements.txt

COPY bot.py ./
COPY prompts ./prompts

CMD ["python", "bot.py"]
