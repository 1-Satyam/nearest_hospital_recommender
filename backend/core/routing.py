import os
import urllib.request
import json
import numpy as np
import pandas as pd
from core.spatial import haversine_vectorized

class RoutingService:
    @staticmethod
    def _external_routing_enabled():
        return (
            os.getenv("APP_ENV", "development").lower() != "production"
            or os.getenv("ENABLE_EXTERNAL_ROUTING", "").lower() == "true"
        )

    @staticmethod
    def get_road_matrix(origin_lat: float, origin_lon: float, dest_lats: list, dest_lons: list, timeout_sec: float = 2.5):
        haversine_km = haversine_vectorized(origin_lat, origin_lon, np.array(dest_lats), np.array(dest_lons))
        fallback_road_km = np.round(haversine_km * 1.28, 1)
        fallback_eta_min = np.maximum(3, np.round((fallback_road_km / 28.0) * 60).astype(int))

        # Primary: Public OSRM Table Service (OpenStreetMap public driving engine, zero API keys)
        try:
            if not RoutingService._external_routing_enabled():
                raise RuntimeError("External routing is disabled by configuration.")
            coords = [f"{origin_lon:.6f},{origin_lat:.6f}"]
            for lon, lat in zip(dest_lons, dest_lats):
                coords.append(f"{lon:.6f},{lat:.6f}")
            
            coord_str = ";".join(coords)
            url = f"https://router.project-osrm.org/table/v1/driving/{coord_str}?sources=0&annotations=duration,distance"
            req = urllib.request.Request(url, headers={'User-Agent': 'Arogya-BBSR-Hospital-Recommender/1.0'})
            with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                if data.get("code") == "Ok" and "distances" in data and "durations" in data:
                    raw_dist = data["distances"][0][1:]
                    raw_dur = data["durations"][0][1:]
                    
                    road_km = []
                    eta_mins = []
                    for idx, (dm, ds) in enumerate(zip(raw_dist, raw_dur)):
                        if dm is not None and dm > 0:
                            road_km.append(round(dm / 1000.0, 1))
                            eta_mins.append(max(2, int(round(ds / 60.0))))
                        else:
                            road_km.append(fallback_road_km[idx])
                            eta_mins.append(fallback_eta_min[idx])
                            
                    return {
                        "road_distance_km": np.array(road_km),
                        "eta_minutes": np.array(eta_mins),
                        "straight_line_km": np.round(haversine_km, 1),
                        "source": "OSRM (OpenStreetMap Road Network)",
                        "is_real_road": True
                    }
        except Exception:
            pass

        # Offline Fallback: Calibrated Urban Circuity Model (1.28x Haversine @ 28 km/h)
        return {
            "road_distance_km": fallback_road_km,
            "eta_minutes": fallback_eta_min,
            "straight_line_km": np.round(haversine_km, 1),
            "source": "Calibrated Road Model (1.28x Haversine)",
            "is_real_road": False
        }

    @staticmethod
    def get_route_geometry(origin_lat: float, origin_lon: float, dest_lat: float, dest_lon: float, timeout_sec: float = 2.5):
        gmaps_url = f"https://www.google.com/maps/dir/?api=1&origin={origin_lat},{origin_lon}&destination={dest_lat},{dest_lon}&travelmode=driving"
        
        try:
            if not RoutingService._external_routing_enabled():
                raise RuntimeError("External routing is disabled by configuration.")
            url = f"https://router.project-osrm.org/route/v1/driving/{origin_lon:.6f},{origin_lat:.6f};{dest_lon:.6f},{dest_lat:.6f}?overview=full&geometries=geojson"
            req = urllib.request.Request(url, headers={'User-Agent': 'Arogya-BBSR-Hospital-Recommender/1.0'})
            with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                if data.get("code") == "Ok" and "routes" in data and len(data["routes"]) > 0:
                    route = data["routes"][0]
                    coords = [[lat, lon] for lon, lat in route["geometry"]["coordinates"]]
                    dist_km = round(route["distance"] / 1000.0, 1)
                    eta_min = max(2, int(round(route["duration"] / 60.0)))
                    return {
                        "coordinates": coords,
                        "distance_km": dist_km,
                        "eta_minutes": eta_min,
                        "google_maps_url": gmaps_url,
                        "provider": "OSRM OpenStreetMap Driving Engine"
                    }
        except Exception:
            pass

        # Fallback waypoints
        pts = [
            [float(origin_lat), float(origin_lon)],
            [float((origin_lat * 2 + dest_lat) / 3), float((origin_lon * 2 + dest_lon) / 3)],
            [float((origin_lat + dest_lat * 2) / 3), float((origin_lon + dest_lon * 2) / 3)],
            [float(dest_lat), float(dest_lon)]
        ]
        h_km = haversine_vectorized(origin_lat, origin_lon, dest_lat, dest_lon)
        return {
            "coordinates": pts,
            "distance_km": round(h_km * 1.28, 1),
            "eta_minutes": max(3, int(round((h_km * 1.28 / 28.0) * 60))),
            "google_maps_url": gmaps_url,
            "provider": "Direct Intercept Model"
        }
