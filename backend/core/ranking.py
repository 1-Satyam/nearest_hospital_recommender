import pandas as pd
import numpy as np
from core.routing import RoutingService

def calculate_score(fee: float, distance_km: float, rating: float) -> float:
    try:
        fee = float(fee) if pd.notna(fee) else 0.0
        distance_km = float(distance_km) if pd.notna(distance_km) else 0.0
        rating = float(rating) if pd.notna(rating) else 0.0
        return (rating * 1000) - fee - distance_km
    except (ValueError, TypeError):
        return 0.0

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
    
    res['general_ward_vacancy_pct'] = np.round(100.0 - res['general_ward_occupancy_pct'], 2)
    
    res['mentor_score'] = [
        calculate_score(fee=row['admission_fee_inr'], distance_km=row['distance_km'], rating=row['rating_5'])
        for _, row in res.iterrows()
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
