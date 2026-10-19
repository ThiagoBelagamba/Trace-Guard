FROM python:3.11-slim

# O wheel padrão do PyPI traz a pilha CUDA (vários GB). O sidecar roda em CPU.
# O torch de CPU entra primeiro e o constraint impede o laya de trocá-lo.
RUN useradd --create-home --uid 10001 --shell /usr/sbin/nologin laya \
    && pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch \
    && python -c "import torch; open('/tmp/torch-constraint.txt','w').write('torch=='+torch.__version__+'\n')" \
    && pip install --no-cache-dir -c /tmp/torch-constraint.txt 'laya[serve]' \
    && python -c "import torch; assert '+cpu' in torch.__version__, torch.__version__"

COPY entrypoint.py /usr/local/bin/laya-entrypoint.py

ENV HOME=/home/laya \
    HF_HOME=/home/laya/.cache/huggingface \
    LAYA_HOST=0.0.0.0 \
    LAYA_PORT=8000 \
    LAYA_DEVICE=cpu \
    LAYA_PRELOAD=1 \
    LAYA_MODELS=multilingual \
    LAYA_DEFAULT_MODEL=multilingual \
    LAYA_THREADS=4

EXPOSE 8000
ENTRYPOINT ["python", "/usr/local/bin/laya-entrypoint.py"]
