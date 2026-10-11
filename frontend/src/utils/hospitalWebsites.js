export const hospitalWebsites = {
  BBSR001: 'https://aiimsbhubaneswar.nic.in/',
  BBSR002: 'https://pgimerch.odisha.gov.in/',
  BBSR003: 'https://sumum.soahospitals.com/',
  BBSR004: 'https://www.carehospitals.com/hospitals/bhubaneswar',
  BBSR005: 'https://www.kalingahospital.com/',
  BBSR006: 'https://www.hi-techmedical.org/',
  BBSR007: 'https://www.apollohospitals.com/hospital/bhubaneshwar',
  BBSR008: 'https://www.manipalhospitals.com/bhubaneswar/',
  BBSR009: 'https://utkalhospital.com/',
  BBSR010: 'https://sparshhospitals.com/',
  BBSR011: 'https://sunshineodisha.com/multispeciality-hospital-bhubaneswar',
  BBSR012: 'https://healthvillagehospital.com/',
  BBSR013: 'https://igkchospitals.com/',
  BBSR014: 'http://www.shreehospitals.com/',
  BBSR015: 'https://sushrutahospital.org/',
  BBSR016: 'https://vivekanandhospital.com/',
  BBSR017: 'https://www.usthihospital.com/',
  BBSR018: 'https://www.maxhealthcare.in/hospital-network/max-super-speciality-hospital-bhubaneswar',
  BBSR019: 'https://jagannathhospital.com/',
  BBSR020: 'https://neelachalhospital.org/',
  BBSR021: 'https://kims.kiit.ac.in/'
};

export function getHospitalWebsite(hospital) {
  const configuredWebsite = hospital?.website;
  if (typeof configuredWebsite === 'string' && /^https?:\/\//i.test(configuredWebsite.trim())) {
    return configuredWebsite.trim();
  }
  return hospitalWebsites[hospital?.hospital_id] || null;
}
