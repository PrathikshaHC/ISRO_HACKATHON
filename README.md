# ISRO_HACKATHON — model handling notes

This repository contains a small Flask app and trained models used for flare prediction.

Model files
- `flare_classifier.joblib`
- `flare_strength_regressor.joblib`

Best practices
- Models are large — we track the compressed copies with Git LFS. If you prefer not to store models in the repo, add them to external storage and set the environment variable `MODEL_URL_BASE` to a URL base where the two files are available (e.g. an S3 pre-signed URL directory). Example:

```powershell
setx MODEL_URL_BASE "https://my-bucket.s3.amazonaws.com/models"
```

The app includes `load_models.py` which will try to download missing models from `MODEL_URL_BASE` when `backend.py` starts.

If you want to keep models out of the repository, add `*.joblib` to `.gitignore` (already present) and upload your models to external storage. Keep a secure backup outside the repo; I placed backups at `D:\model_backups_outside_repo` when cleaning history.

Quick local test

1. Install deps: `pip install -r requirements.txt` (add `requests` if you plan to use downloads)
2. Run the loader check:

```powershell
python load_models.py
```

3. Run the app:

```powershell
python backend.py
```
