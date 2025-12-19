FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies including WeasyPrint requirements
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    libpq-dev \
    # WeasyPrint dependencies for PDF generation
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    shared-mime-info \
    libcairo2 \
    libglib2.0-0 \
    fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

# Proje dosyalarını kopyala
COPY backend/ /app/

# Bağımlılıkları yükle
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir .

EXPOSE 8000

# Copy and make startup script executable
COPY backend/scripts/startup.sh /app/scripts/startup.sh
RUN chmod +x /app/scripts/startup.sh

# Use startup script with timeout for migrations
CMD ["/app/scripts/startup.sh"]
