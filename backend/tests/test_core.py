import unittest
import numpy as np
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from core.ranking import calculate_score
from core.spatial import haversine_vectorized
from data_engine.loader import load_hospitals

class TestBackendCore(unittest.TestCase):
    
    def test_mentor_ranking_formula(self):
        """Verify exact formula: Score = -(fee) + -(distance) + (rating * 1000)"""
        score = calculate_score(fee=2000, distance_km=5, rating=4.5)
        self.assertEqual(score, 2495.0)

    def test_mentor_ranking_missing_values(self):
        """Verify missing values do not crash ranking and default gracefully."""
        score = calculate_score(fee=np.nan, distance_km=10, rating=4.0)
        self.assertEqual(score, (4.0 * 1000) - 0 - 10)

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
