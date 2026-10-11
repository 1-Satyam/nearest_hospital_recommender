export function getGeneralWardVacancyPercent(hospital) {
  const rawPercent = hospital?.general_ward_vacancy_pct;
  const providedPercent = Number(rawPercent);
  if (rawPercent !== null && rawPercent !== undefined && rawPercent !== '' && Number.isFinite(providedPercent)) {
    return Math.min(100, Math.max(0, providedPercent));
  }

  const availableBeds = Number(hospital?.general_ward_available_beds);
  const totalBeds = Number(hospital?.general_ward_total_beds);
  if (!Number.isFinite(availableBeds) || !Number.isFinite(totalBeds) || totalBeds <= 0) {
    return null;
  }

  return Math.round(Math.min(100, Math.max(0, availableBeds / totalBeds * 100)) * 10) / 10;
}

export function isHospitalPmjayEmpanelled(hospital) {
  const value = hospital?.pmjay_active ?? hospital?.pmjay_gjay_empanelled;
  return value === true || value === 1 || ['true', '1', 'yes', 'y'].includes(String(value ?? '').trim().toLowerCase());
}

export function isHospitalEmergencyReady(hospital) {
  const value = hospital?.emergency_ready ?? hospital?.emergency_24x7;
  return value === true || value === 1 || ['true', '1', 'yes', 'y'].includes(String(value ?? '').trim().toLowerCase());
}
