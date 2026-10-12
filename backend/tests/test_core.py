import unittest
import numpy as np
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from core.ranking import calculate_score
from core.spatial import haversine_vectorized
from data_engine.loader import load_hospitals

class TestBackendCore(unittest.TestCase):
    
    def test_availability_weighted_ranking_formula(self):
        """Availability is weighted most; ratings and reviews help, while distance and fee reduce score."""
        score = calculate_score(
            availability_pct=80,
            rating=4.5,
            review_count=200,
            distance_km=5,
            fee=2000,
        )
        self.assertEqual(score, 6895.0)

    def test_availability_weighted_ranking_missing_values(self):
        """Missing values do not crash ranking and default to zero contributions."""
        score = calculate_score(
            availability_pct=np.nan,
            rating=4.0,
            review_count=100,
            distance_km=10,
            fee=np.nan,
        )
        self.assertEqual(score, 390.0)

    def test_availability_percentage_uses_available_beds(self):
        from core.ranking import calculate_availability_pct

        self.assertEqual(calculate_availability_pct(9, 47), 9 / 47 * 100)
        self.assertEqual(calculate_availability_pct(0, 47), 0.0)
        self.assertEqual(calculate_availability_pct(10, 0), 0.0)

    def test_haversine_distance(self):
        """Verify distance calculations are correct."""
        dist = haversine_vectorized(20.296, 85.824, 20.296, 85.824)
        self.assertEqual(dist, 0.0)
        
        dist_1deg = haversine_vectorized(20.0, 85.0, 21.0, 85.0)
        self.assertTrue(110 < dist_1deg < 112)

    def test_csv_integrity_and_merges(self):
        """Verify master schema is unmodified and joins succeed."""
        df = load_hospitals()
        self.assertEqual(len(df), 21, "Dataset should have exactly 21 hospitals.")
        expected_cols = [
            'hospital_id', 'hospital_name', 'latitude', 'longitude', 
            'pmjay_gjay_empanelled', 'emergency_24x7', 'image_hero'
        ]
        for col in expected_cols:
            self.assertIn(col, df.columns, f"Missing column: {col}")

if __name__ == '__main__':
    unittest.main()
