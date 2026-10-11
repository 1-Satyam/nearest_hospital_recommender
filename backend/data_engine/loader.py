import os
import pandas as pd

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
PROJECT_ROOT = os.path.abspath(os.path.join(BACKEND_DIR, ".."))


def get_csv_path(filename):
    candidates = [
        os.path.join(PROJECT_ROOT, "data", filename),
        os.path.join(BACKEND_DIR, "data", filename),
        os.path.join(os.getcwd(), "data", filename),
        os.path.join(os.getcwd(), filename),
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    return candidates[0]


def _normalize_yes_no(value):
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return "No"
    text = str(value).strip().lower()
    if text in {"yes", "y", "true", "1", "t", "on"}:
        return "Yes"
    return "No"


def _validate_hospital_frame(df, csv_path):
    required_columns = {
        "hospital_id",
        "hospital_name",
        "latitude",
        "longitude",
        "pmjay_gjay_empanelled",
        "emergency_24x7",
        "image_hero",
    }
    missing = sorted(required_columns - set(df.columns))
    if missing:
        raise ValueError(f"{csv_path} is missing required hospital columns: {missing}")

    df = df.copy()
    df["hospital_id"] = df["hospital_id"].astype(str).str.strip()
    df["hospital_name"] = df["hospital_name"].fillna("").astype(str).str.strip()
    if "latitude" in df.columns:
        df["latitude"] = pd.to_numeric(df["latitude"], errors="coerce")
    if "longitude" in df.columns:
        df["longitude"] = pd.to_numeric(df["longitude"], errors="coerce")
    if "rating" in df.columns:
        df["rating"] = pd.to_numeric(df["rating"], errors="coerce").fillna(4.0)
    if "rating_count" in df.columns:
        df["rating_count"] = pd.to_numeric(df["rating_count"], errors="coerce").fillna(0).astype(int)
    if "admission_fee_inr" in df.columns:
        df["admission_fee_inr"] = pd.to_numeric(df["admission_fee_inr"], errors="coerce").fillna(0).astype(int)
    if "admission_fee" in df.columns:
        df["admission_fee"] = pd.to_numeric(df["admission_fee"], errors="coerce").fillna(df["admission_fee_inr"])
    if "pmjay_gjay_empanelled" in df.columns:
        df["pmjay_gjay_empanelled"] = df["pmjay_gjay_empanelled"].map(_normalize_yes_no)
    if "emergency_24x7" in df.columns:
        df["emergency_24x7"] = df["emergency_24x7"].map(_normalize_yes_no)
    if "pmjay_active" in df.columns:
        df["pmjay_active"] = df["pmjay_active"].map(lambda value: value if isinstance(value, bool) else str(value).strip().lower() in {"true", "yes", "1"})
    if "emergency_ready" in df.columns:
        df["emergency_ready"] = df["emergency_ready"].map(lambda value: value if isinstance(value, bool) else str(value).strip().lower() in {"true", "yes", "1"})
    if "image_hero" in df.columns:
        df["image_hero"] = df["image_hero"].fillna("").astype(str)
    return df


def load_hospitals():
    csv_file = get_csv_path("hospitals.csv")
    if not os.path.exists(csv_file):
        raise FileNotFoundError(f"Hospital dataset not found at {csv_file}")

    try:
        df = pd.read_csv(csv_file)
    except Exception as exc:
        raise ValueError(f"Could not read hospital dataset {csv_file}: {exc}") from exc

    return _validate_hospital_frame(df, csv_file)


def load_specialty_beds():
    csv_file = get_csv_path("specialty_beds.csv")
    if not os.path.exists(csv_file):
        raise FileNotFoundError(f"Specialty bed dataset not found at {csv_file}")

    try:
        df = pd.read_csv(csv_file)
    except Exception as exc:
        raise ValueError(f"Could not read specialty bed dataset {csv_file}: {exc}") from exc

    required_columns = {"hospital_id", "specialty", "available_beds"}
    missing = sorted(required_columns - set(df.columns))
    if missing:
        raise ValueError(f"{csv_file} is missing required specialty-bed columns: {missing}")

    df = df.copy()
    df["hospital_id"] = df["hospital_id"].astype(str).str.strip()
    df["specialty"] = df["specialty"].fillna("").astype(str).str.strip()
    df["available_beds"] = pd.to_numeric(df["available_beds"], errors="coerce").fillna(0)
    return df

