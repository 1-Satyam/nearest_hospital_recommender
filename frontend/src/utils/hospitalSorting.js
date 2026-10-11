import { getGeneralWardVacancyPercent } from './hospitalMetrics';

export const HOSPITAL_SORT_DEFAULTS = {
  distance: 'asc',
  fee: 'asc',
  ratingReviews: 'desc',
  vacancy: 'desc'
};

export function getHospitalSortValue(hospital, key) {
  switch (key) {
    case 'distance': {
      const distance = Number(hospital.road_distance_km ?? hospital.distance_km);
      return Number.isFinite(distance) ? distance : null;
    }
    case 'fee': {
      const fee = Number(hospital.admission_fee_inr);
      return Number.isFinite(fee) ? fee : null;
    }
    case 'ratingReviews': {
      const rating = Number(hospital.rating_5 ?? hospital.rating);
      const reviews = Number(hospital.review_count ?? hospital.rating_count);
      return Number.isFinite(rating) && Number.isFinite(reviews) ? rating * reviews : null;
    }
    case 'vacancy': {
      const vacancy = getGeneralWardVacancyPercent(hospital);
      return vacancy === null ? null : Number(vacancy);
    }
    default:
      return null;
  }
}

export function sortHospitals(hospitals, key, direction = 'asc') {
  const multiplier = direction === 'asc' ? 1 : -1;
  return hospitals
    .map((hospital, index) => ({ hospital, index }))
    .sort((left, right) => {
      const leftValue = key === 'recommended'
        ? Number(left.hospital.rank)
        : getHospitalSortValue(left.hospital, key);
      const rightValue = key === 'recommended'
        ? Number(right.hospital.rank)
        : getHospitalSortValue(right.hospital, key);
      const leftValid = Number.isFinite(leftValue);
      const rightValid = Number.isFinite(rightValue);

      if (!leftValid && !rightValid) return left.index - right.index;
      if (!leftValid) return 1;
      if (!rightValid) return -1;
      return (leftValue - rightValue) * multiplier || left.index - right.index;
    })
    .map(({ hospital }) => hospital);
}
