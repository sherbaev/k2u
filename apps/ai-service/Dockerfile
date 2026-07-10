FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY train ./train
# artifacts/ is gitignored (produced by training). Create an empty dir so the
# service starts with the physics fallback; train + rebuild (or mount a volume)
# to serve the real model. Optionally uncomment to train at build time:
#   RUN python train/generate.py --pv 120 --tc 120 && python train/train.py
RUN mkdir -p /app/artifacts

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health').status==200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
