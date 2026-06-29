from pathlib import Path

import joblib
from flask import Flask, jsonify, request
from werkzeug.exceptions import BadRequest

FEATURE_COLUMNS = [
    'HHH X-pos',
    'HHH y-pos',
    'AAA lo',
    'AAA hi',
    'AAA X-pos',
    'AAA Y-pos',
    'AAA',
    'BBB',
    'CCC',
    'DDD',
    'EEE',
    'FFF',
    'GGG',
    'duration_sec',
    'rise_sec',
    'decay_sec',
    'start_hour',
    'start_weekday',
]

MODEL_DIR = Path(__file__).resolve().parent
CLASSIFIER_PATH = MODEL_DIR / 'flare_classifier.joblib'
REGRESSOR_PATH = MODEL_DIR / 'flare_strength_regressor.joblib'

try:
    # ensure models exist (will attempt download if MODEL_URL_BASE is set)
    from load_models import ensure_models

    ensure_models(MODEL_DIR)
except Exception as e:
    # If ensure_models fails, we keep going so the original FileNotFoundError is raised
    # when attempting to load the models below. This prints a concise hint.
    print('Model check warning:', e)

app = Flask(__name__)


@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response


def load_model(path: Path):
    if not path.exists():
        raise FileNotFoundError(f'Model file not found: {path}')
    return joblib.load(path)


classifier = load_model(CLASSIFIER_PATH)
regressor = load_model(REGRESSOR_PATH)


def parse_input(data: dict):
    if not isinstance(data, dict):
        raise BadRequest('Request JSON body must be an object of feature values.')

    values = []
    missing_fields = []
    invalid_fields = []

    for feature in FEATURE_COLUMNS:
        if feature not in data:
            missing_fields.append(feature)
            continue

        value = data[feature]
        try:
            values.append(float(value))
        except (TypeError, ValueError):
            invalid_fields.append(f'{feature}={value}')

    if missing_fields:
        raise BadRequest(f'Missing required fields: {", ".join(missing_fields)}')
    if invalid_fields:
        raise BadRequest(f'Invalid numeric values: {", ".join(invalid_fields)}')

    return [values]


@app.route('/api/features', methods=['GET'])
def features():
    return jsonify({'features': FEATURE_COLUMNS})


@app.route('/api/predict', methods=['POST'])
def predict():
    request_data = request.get_json(silent=True)
    if request_data is None:
        raise BadRequest('Invalid JSON payload. Send a JSON object with the model feature values.')

    X = parse_input(request_data)

    predicted_class = classifier.predict(X)[0]
    predicted_strength = float(regressor.predict(X)[0])

    return jsonify(
        {
            'flare_prefix': predicted_class,
            'flare_strength': predicted_strength,
            'input': {feature: float(value) for feature, value in zip(FEATURE_COLUMNS, X[0])},
        }
    )


@app.errorhandler(BadRequest)
def handle_bad_request(error):
    response = jsonify({'error': error.description})
    response.status_code = 400
    return response


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000)
