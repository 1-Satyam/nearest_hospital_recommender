from functools import lru_cache
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error

from data_engine.loader import load_hospitals

_TRAINING_DAYS = 120
_TRAINING_CUTOFF = 90


def _daily_inventory_series(available_beds: float, total_beds: float, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    baseline = float(np.clip(available_beds, 0, total_beds))
    amplitude = min(max(total_beds * 0.035, 1.0), max(total_beds * 0.12, 1.0))
    noise_scale = max(total_beds * 0.012, 0.5)
    values = [baseline]

    for day in range(1, _TRAINING_DAYS + 1):
        weekly_cycle = amplitude * 0.35 * np.sin(2 * np.pi * day / 7)
        slower_cycle = amplitude * np.sin(2 * np.pi * day / 30)
        drift = amplitude * 0.12 * day / _TRAINING_DAYS
        noise = rng.normal(0, noise_scale)
        values.append(float(np.clip(baseline + weekly_cycle + slower_cycle + drift + noise, 0, total_beds)))

    return np.asarray(values, dtype=float)


def _feature_row(
    series: np.ndarray,
    total_beds: float,
    day: int,
) -> list[float]:
    available = float(series[day])
    return [
        available,
        float(series[day - 1]),
        float(series[day - 7]),
        float(total_beds),
        float(day % 7),
        100.0 * (total_beds - available) / total_beds if total_beds else 0.0,
    ]


@lru_cache(maxsize=1)
def _train_demo_model():
    hospitals = load_hospitals()
    training_features = []
    training_targets = []
    validation_features = []
    validation_targets = []

    for index, hospital in hospitals.reset_index(drop=True).iterrows():
        total_beds = pd.to_numeric(hospital.get("general_ward_total_beds"), errors="coerce")
        available_beds = pd.to_numeric(hospital.get("general_ward_available_beds"), errors="coerce")
        if pd.isna(total_beds) or pd.isna(available_beds) or total_beds <= 0:
            continue

        series = _daily_inventory_series(
            float(available_beds),
            float(total_beds),
            seed=20261011 + index,
        )
        for day in range(7, _TRAINING_DAYS):
            features = _feature_row(series, float(total_beds), day)
            target = float(series[day + 1])
            if day < _TRAINING_CUTOFF:
                training_features.append(features)
                training_targets.append(target)
            else:
                validation_features.append(features)
                validation_targets.append(target)

    if not training_features or not validation_features:
        raise ValueError("Not enough hospital records to train and validate the demo forecast model.")

    model = GradientBoostingRegressor(
        n_estimators=80,
        learning_rate=0.04,
        max_depth=2,
        loss="huber",
        random_state=42,
    )
    model.fit(np.asarray(training_features), np.asarray(training_targets))
    validation_mae = float(
        mean_absolute_error(validation_targets, model.predict(np.asarray(validation_features)))
    )
    return model, validation_mae


def predict_demo_availability(hospital: dict[str, Any]) -> dict[str, Any]:
    total_beds = pd.to_numeric(hospital.get("general_ward_total_beds"), errors="coerce")
    available_beds = pd.to_numeric(hospital.get("general_ward_available_beds"), errors="coerce")
    if pd.isna(total_beds) or pd.isna(available_beds) or total_beds <= 0:
        return {
            "forecast_available_beds_24h": None,
            "forecast_vacancy_pct_24h": None,
            "forecast_mode": "synthetic_demo",
            "forecast_is_operational": False,
        }

    model, validation_mae = _train_demo_model()
    baseline = float(np.clip(available_beds, 0, total_beds))
    feature_row = [[
        baseline,
        baseline,
        baseline,
        float(total_beds),
        float(pd.Timestamp.now(tz="UTC").dayofweek),
        100.0 * (float(total_beds) - baseline) / float(total_beds),
    ]]
    predicted_beds = int(round(float(np.clip(model.predict(feature_row)[0], 0, total_beds))))

    return {
        "forecast_available_beds_24h": predicted_beds,
        "forecast_vacancy_pct_24h": round(100.0 * predicted_beds / float(total_beds), 1),
        "forecast_mode": "synthetic_demo",
        "forecast_is_operational": False,
        "demo_validation_mae_beds": round(validation_mae, 1),
    }
