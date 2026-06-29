from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import (accuracy_score, classification_report,
                             mean_absolute_error, r2_score)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


def load_flare_data(csv_path: Path) -> pd.DataFrame:
    df = pd.read_csv(csv_path)
    df['JJJ Start'] = pd.to_datetime(df['JJJ Start'], errors='coerce')
    df['JJJ Peak'] = pd.to_datetime(df['JJJ Peak'], errors='coerce')
    df['JJJ End'] = pd.to_datetime(df['JJJ End'], errors='coerce')

    df['duration_sec'] = (df['JJJ End'] - df['JJJ Start']).dt.total_seconds().fillna(0)
    df['rise_sec'] = (df['JJJ Peak'] - df['JJJ Start']).dt.total_seconds().fillna(0)
    df['decay_sec'] = (df['JJJ End'] - df['JJJ Peak']).dt.total_seconds().fillna(0)
    df['start_hour'] = df['JJJ Start'].dt.hour.fillna(0).astype(int)
    df['start_weekday'] = df['JJJ Start'].dt.weekday.fillna(0).astype(int)

    df['class_prefix'] = df['JJJ Class'].str[0]
    df['flare_strength'] = df['JJJ Class'].apply(_compute_flare_strength)

    return df


def _compute_flare_strength(label: str) -> float:
    if not isinstance(label, str) or len(label) < 2:
        return 0.0

    level_map = {
        'B': 1.0,
        'C': 10.0,
        'M': 100.0,
        'X': 1000.0,
    }
    scale = level_map.get(label[0].upper(), 1.0)

    try:
        magnitude = float(label[1:])
    except ValueError:
        magnitude = 0.0

    return scale * magnitude


def build_feature_matrix(df: pd.DataFrame) -> pd.DataFrame:
    feature_columns = [
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
    return df[feature_columns]


def train_models(df: pd.DataFrame, output_dir: Path) -> None:
    X = build_feature_matrix(df)
    y_class = df['class_prefix']
    y_strength = df['flare_strength']

    X_train, X_test, y_train, y_test, y_strength_train, y_strength_test = train_test_split(
        X,
        y_class,
        y_strength,
        test_size=0.2,
        random_state=42,
        stratify=y_class,
    )

    classifier = Pipeline(
        [
            ('scale', StandardScaler()),
            ('clf', RandomForestClassifier(n_estimators=150, random_state=42, n_jobs=-1)),
        ]
    )

    regressor = Pipeline(
        [
            ('scale', StandardScaler()),
            ('reg', RandomForestRegressor(n_estimators=150, random_state=42, n_jobs=-1)),
        ]
    )

    classifier.fit(X_train, y_train)
    regressor.fit(X_train, y_strength_train)

    predicted_class = classifier.predict(X_test)
    predicted_strength = regressor.predict(X_test)

    print('=== Classification: flare category prefix ===')
    print('Accuracy:', accuracy_score(y_test, predicted_class))
    print(classification_report(y_test, predicted_class, digits=4))

    print('=== Regression: flare strength score ===')
    print('MAE:', mean_absolute_error(y_strength_test, predicted_strength))
    print('R2:', r2_score(y_strength_test, predicted_strength))

    classifier_path = output_dir / 'flare_classifier.joblib'
    regressor_path = output_dir / 'flare_strength_regressor.joblib'
    joblib.dump(classifier, classifier_path)
    joblib.dump(regressor, regressor_path)

    print(f'Classifier saved to: {classifier_path}')
    print(f'Regressor saved to: {regressor_path}')


if __name__ == '__main__':
    project_root = Path(__file__).resolve().parent
    dataset_path = project_root / 'flares_and_instruments_v2.csv'
    if not dataset_path.exists():
        raise FileNotFoundError(
            f'Dataset not found at {dataset_path}. Place flares_and_instruments_v2.csv in the project root.'
        )

    data = load_flare_data(dataset_path)
    train_models(data, project_root)
