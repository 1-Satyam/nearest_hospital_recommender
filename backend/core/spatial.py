import numpy as np
import pandas as pd
from sklearn.neighbors import BallTree

def haversine_vectorized(lat1, lon1, lat2, lon2):
    R = 6371.0 # Earth radius in km
    lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = np.sin(dlat/2)**2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon/2)**2
    c = 2 * np.arcsin(np.sqrt(a))
    return R * c

class HospitalSpatialIndex:
    def __init__(self, hospitals_df: pd.DataFrame):
        self.df = hospitals_df.reset_index(drop=True)
        coords_rad = np.radians(self.df[['latitude', 'longitude']].values)
        self.tree = BallTree(coords_rad, metric='haversine')

    def query_nearest(self, user_lat: float, user_lon: float, k: int = 10):
        user_coords_rad = np.radians([[user_lat, user_lon]])
        k = min(k, len(self.df))
        dist_rad, indices = self.tree.query(user_coords_rad, k=k)
        dist_km = dist_rad[0] * 6371.0
        nearest_df = self.df.iloc[indices[0]].copy()
        nearest_df['distance_km'] = np.round(dist_km, 2)
        return nearest_df
