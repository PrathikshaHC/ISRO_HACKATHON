from pathlib import Path
import os
import sys

try:
    import requests
except Exception:
    requests = None

from joblib import load


def _download_file(url: str, dest: Path):
    dest.parent.mkdir(parents=True, exist_ok=True)
    if requests is None:
        raise RuntimeError('requests is required to download models; install with `pip install requests`')
    resp = requests.get(url, stream=True)
    resp.raise_for_status()
    with open(dest, 'wb') as f:
        for chunk in resp.iter_content(1024 * 1024):
            if chunk:
                f.write(chunk)


def ensure_models(model_dir: Path):
    """Ensure model files exist in `model_dir`.

    Behavior:
    - If a model file is missing and the env var `MODEL_URL_BASE` is set, attempt to download
      ``MODEL_URL_BASE/<filename>``.
    - If missing and no URL base is set, raise FileNotFoundError with instructions.
    """
    model_dir = Path(model_dir)
    candidates = [
        'flare_classifier.joblib',
        'flare_strength_regressor.joblib',
    ]
    base = os.environ.get('MODEL_URL_BASE')
    for name in candidates:
        path = model_dir / name
        if path.exists():
            continue
        if not base:
            raise FileNotFoundError(
                f'Model {name} not found at {path!s}. Set MODEL_URL_BASE env var to download or place the file there.'
            )
        url = base.rstrip('/') + '/' + name
        _download_file(url, path)


def load_model(path: Path):
    return load(path)


if __name__ == '__main__':
    # quick CLI to check or download models
    md = Path(__file__).resolve().parent
    try:
        ensure_models(md)
        print('Models present')
    except Exception as e:
        print('ensure_models failed:', e)
        sys.exit(1)
