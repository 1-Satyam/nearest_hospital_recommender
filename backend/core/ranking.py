import pandas as pd
import numpy as np
from core.routing import RoutingService


def _number_or_zero(value: float) -> float:
    try:
        number = float(value)
        return number if np.isfinite(number) else 0.0
    except (TypeError, ValueError):
        return 0.0


def calculate_availability_pct(available_beds: float, total_beds: float) -> float:
    available = max(0.0, _number_or_zero(available_beds))
    total = _number_or_zero(total_beds)
    if total <= 0:
        return 0.0
    return float(np.clip(available / total * 100.0, 0.0, 100.0))


def calculate_score(
    availability_pct: float,
    rating: float,
    review_count: float,
    distance_km: float,
    fee: float,
) -> float:
    availability = float(np.clip(_number_or_zero(availability_pct), 0.0, 100.0))
    rating_review_weight = _number_or_zero(rating) * max(0.0, _number_or_zero(review_count))
    distance = max(0.0, _number_or_zero(distance_km))
    admission_fee = max(0.0, _number_or_zero(fee))
    return availability * 100.0 + rating_review_weight - distance - admission_fee

def rank_and_format_hospitals(
    df: pd.DataFrame, 
    user_lat: float, 
    user_lon: float, 
    top_n: int = 10,
    specialty: str = None,
    pmjay_only: bool = False,
    emergency_only: bool = False
) -> pd.DataFrame:
    res = df.copy()
    
    matrix = RoutingService.get_road_matrix(
        origin_lat=user_lat,
        origin_lon=user_lon,
        dest_lats=res['latitude'].tolist(),
        dest_lons=res['longitude'].tolist()
    )
    
    res['straight_line_km'] = matrix['straight_line_km']
    res['road_distance_km'] = matrix['road_distance_km']
    res['distance_km'] = matrix['road_distance_km']
    res['eta_minutes'] = matrix['eta_minutes']
    res['distance_source'] = matrix['source']
    res['is_real_road'] = matrix['is_real_road']
    
    if 'general_ward_occupancy_pct' in res.columns:
        occupancy = pd.to_numeric(res['general_ward_occupancy_pct'], errors='coerce').fillna(100.0)
        res['availability_pct'] = np.clip(100.0 - occupancy, 0.0, 100.0)
    elif {'general_ward_available_beds', 'general_ward_total_beds'}.issubset(res.columns):
        res['availability_pct'] = [
            calculate_availability_pct(row['general_ward_available_beds'], row['general_ward_total_beds'])
            for _, row in res.iterrows()
        ]
    else:
        res['availability_pct'] = 0.0
    res['general_ward_vacancy_pct'] = res['availability_pct']

    review_counts = res['rating_count'] if 'rating_count' in res.columns else pd.Series(0, index=res.index)
    res['mentor_score'] = [
        calculate_score(
            availability_pct=row['availability_pct'],
            rating=row['rating_5'],
            review_count=review_count,
            distance_km=row['distance_km'],
            fee=row['admission_fee_inr'],
        )
        for (_, row), review_count in zip(res.iterrows(), review_counts)
    ]
    
    if pmjay_only:
        res = res[res['pmjay_gjay_empanelled'].astype(str).str.lower() == 'yes']
    if emergency_only:
        res = res[res['emergency_24x7'].astype(str).str.lower() == 'yes']
    if specialty:
        spec_clean = specialty.lower().strip()
        if 'pediatric' in spec_clean or 'paediatric' in spec_clean:
            res = res[res['specialties'].astype(str).str.contains('Pediatrics|Paediatrics', case=False, na=False)]
        elif 'orthopedic' in spec_clean or 'orthopaedic' in spec_clean:
            res = res[res['specialties'].astype(str).str.contains('Orthopedics|Orthopaedics', case=False, na=False)]
        elif 'obstetric' in spec_clean or 'gynaec' in spec_clean or 'ob-gyn' in spec_clean:
            res = res[res['specialties'].astype(str).str.contains('Obstetrics|Gynaecology', case=False, na=False)]
        else:
            res = res[res['specialties'].astype(str).str.contains(specialty, case=False, na=False)]
        
    res = res.sort_values(
        by=['mentor_score', 'general_ward_available_beds', 'distance_km', 'hospital_id'],
        ascending=[False, False, True, True]
    ).reset_index(drop=True)
    
    displayed = res.head(10).copy()
    displayed['rank'] = displayed.index + 1
    displayed['is_in_top_n'] = displayed['rank'] <= top_n
    
    displayed['directions_url'] = [
        f"https://www.google.com/maps/dir/?api=1&origin={user_lat},{user_lon}&destination={lat},{lon}&travelmode=driving"
        for lat, lon in zip(displayed['latitude'], displayed['longitude'])
    ]
    
    return displayed
