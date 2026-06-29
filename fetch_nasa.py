from datetime import datetime, timedelta
from pathlib import Path
import os
import requests
from joblib import load

MODEL_DIR = Path(__file__).resolve().parent
CLASSIFIER_PATH = MODEL_DIR / 'flare_classifier.joblib'
REGRESSOR_PATH = MODEL_DIR / 'flare_strength_regressor.joblib'


def _nasa_flare_events(start_date: str, end_date: str, api_key: str):
    url = 'https://api.nasa.gov/DONKI/FLR'
    params = {'startDate': start_date, 'endDate': end_date, 'api_key': api_key}
    resp = requests.get(url, params=params, timeout=15)
    resp.raise_for_status()
    return resp.json()


def _parse_location(loc_str: str):
    # Parse strings like 'N10W20' -> (x=20,y=10)
    if not loc_str:
        return None, None
    try:
        # remove possible whitespace
        s = loc_str.strip().upper()
        # find latitude (N/S) and longitude (E/W)
        import re

        m = re.match(r'([NS])(\d+)([EW])(\d+)', s)
        if not m:
            return None, None
        lat_sign, lat_val, lon_sign, lon_val = m.groups()
        y = int(lat_val) * (1 if lat_sign == 'N' else -1)
        x = int(lon_val) * (1 if lon_sign == 'E' else -1)
        return x, y
    except Exception:
        return None, None


def _class_to_numeric(class_str: str):
    # Map flare class like 'M1.8' -> numeric score
    if not class_str:
        return 0.0
    try:
        letter = class_str[0].upper()
        mag = float(class_str[1:]) if len(class_str) > 1 else 0.0
        base = {'A': 0.0, 'B': 1.0, 'C': 2.0, 'M': 3.0, 'X': 4.0}.get(letter, 0.0)
        return base + mag / 10.0
    except Exception:
        return 0.0


def build_features_from_events(date: datetime, events: list):
    # Simple heuristic mapping from DONKI events to model features
    # This is approximate — adapt mappings as you prefer.
    count = len(events)
    max_class = 0.0
    xs = []
    ys = []
    for ev in events:
        cl = ev.get('classType') or ev.get('flrType') or ev.get('peakClass')
        max_class = max(max_class, _class_to_numeric(cl))
        loc = ev.get('location') or ev.get('beginPointLocation') or ev.get('heliographicLocation')
        x, y = _parse_location(loc) if loc else (None, None)
        if x is not None:
            xs.append(x)
        if y is not None:
            ys.append(y)

    avg_x = sum(xs) / len(xs) if xs else 0.0
    avg_y = sum(ys) / len(ys) if ys else 0.0

    # Map into the FEATURE_COLUMNS expected by model
    features = {
        'HHH X-pos': avg_x,
        'HHH y-pos': avg_y,
        'AAA lo': max(0.0, max_class - 0.5),
        'AAA hi': max_class * 10.0,
        'AAA X-pos': avg_x,
        'AAA Y-pos': avg_y,
        'AAA': count * 1.0,
        'BBB': count * 2.0,
        'CCC': max_class,
        'DDD': max_class * 2.0,
        'EEE': 10.0 if count > 0 else 0.0,
        'FFF': 5.0 * count,
        'GGG': date.timetuple().tm_yday % 100,
        'duration_sec': 3600.0 * max(1, count),
        'rise_sec': 600.0 if count > 0 else 300.0,
        'decay_sec': 1800.0 if count > 0 else 900.0,
        'start_hour': 12.0,
        'start_weekday': float(date.weekday()),
    }
    return features


def historical_predictions(days=7):
    api_key = os.environ.get('NASA_API_KEY', 'DEMO_KEY')
    today = datetime.utcnow().date()
    classifier = load(CLASSIFIER_PATH)
    regressor = load(REGRESSOR_PATH)

    results = []
    for i in range(days - 1, -1, -1):
        d = today - timedelta(days=i)
        start = d.isoformat()
        end = d.isoformat()
        try:
            events = _nasa_flare_events(start, end, api_key)
        except Exception:
            events = []

        features = build_features_from_events(d, events)
        # prepare model input vector in original order
        feature_order = [
            'HHH X-pos', 'HHH y-pos', 'AAA lo', 'AAA hi', 'AAA X-pos', 'AAA Y-pos', 'AAA', 'BBB', 'CCC', 'DDD',
            'EEE', 'FFF', 'GGG', 'duration_sec', 'rise_sec', 'decay_sec', 'start_hour', 'start_weekday'
        ]
        X = [[float(features.get(k, 0.0)) for k in feature_order]]
        try:
            pred_class = classifier.predict(X)[0]
            pred_strength = float(regressor.predict(X)[0])
        except Exception:
            pred_class = None
            pred_strength = None

        results.append({
            'date': start,
            'label': d.strftime('%a'),
            'predicted_class': pred_class,
            'predicted_strength': pred_strength,
            'count_events': len(events),
        })

    return results
