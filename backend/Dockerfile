FROM python:3.9-slim

# Install library sistem yang dibutuhkan OpenCV & GLib
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Set folder kerja
WORKDIR /code

# Copy requirements dan install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy semua kode
COPY . .

# Buat folder uploads & results biar tidak error
RUN mkdir uploads results

# Jalankan aplikasi di port 7860 (Port khusus Hugging Face)
CMD ["gunicorn", "-b", "0.0.0.0:7860", "app:app"]