# syntax=docker/dockerfile:1
FROM python:3.12-slim AS prod

# Unbuffered + faulthandler so step logs flush immediately (crucial for
# debugging a failed pod) and tracebacks are complete; skip .pyc clutter.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONFAULTHANDLER=1

# register.py uses only the standard library.
WORKDIR /app
COPY register.py .
# Fail the build early if the script is broken.
RUN python -c "import register"
ENTRYPOINT ["python", "register.py"]
