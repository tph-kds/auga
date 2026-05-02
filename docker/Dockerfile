# Dockerfile for RL Sandbox Environment
FROM python:3.11-slim

# Prevent python from writing .pyc files
ENV PYTHONDONTWRITEBYTECODE=1
# Enable unbuffered output
ENV PYTHONUNBUFFERED=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    git \
    curl \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Set workdir
WORKDIR /workspace

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Create non-root user
RUN useradd -m -u 1000 rluser && \
    chown -R rluser:rluser /workspace

USER rluser

# Set PYTHONPATH for plugin discovery
ENV PYTHONPATH=/workspace:$PYTHONPATH

# Default command (can be overridden)
CMD ["python", "-c", "print('RL Sandbox ready')"]
