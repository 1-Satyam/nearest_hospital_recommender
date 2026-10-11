import pandas as pd
import numpy as np
import os

base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
data_dir = os.path.join(base_dir, "data")
master = pd.read_csv(os.path.join(data_dir, "hospital_master.csv"))
specs_df = pd.read_csv(os.path.join(data_dir, "hospital_specialities.csv"))

records = []
np.random.seed(42)

for _, h in master.iterrows():
    hid = h['hospital_id']
    base_fee = int(h['admission_fee_inr'])
    
    # 1. Emergency
    tot_em = int(np.random.randint(15, 35))
    occ_em = int(np.random.randint(5, tot_em))
    records.append({
        'hospital_id': hid,
        'specialty': 'Emergency',
        'bed_type': 'ICU',
        'total_beds': tot_em,
        'occupied_beds': occ_em,
        'available_beds': tot_em - occ_em,
        'occupancy_pct': round((occ_em / tot_em) * 100, 2),
        'admission_fee_inr': base_fee + 500,
        'last_updated': '2026-10-10T00:00:00Z'
    })
    
    # 2. General Ward
    tot_gw = int(h['general_ward_total_beds'])
    avail_gw = int(h['general_ward_available_beds'])
    occ_gw = tot_gw - avail_gw
    records.append({
        'hospital_id': hid,
        'specialty': 'General Ward',
        'bed_type': 'Standard',
        'total_beds': tot_gw,
        'occupied_beds': occ_gw,
        'available_beds': avail_gw,
        'occupancy_pct': round((occ_gw / tot_gw) * 100, 2),
        'admission_fee_inr': base_fee,
        'last_updated': '2026-10-10T00:00:00Z'
    })
    
    # 3. Specialty records
    h_specs = [s.strip() for s in specs_df[specs_df['hospital_id'] == hid]['specialties'].values[0].replace(';', ',').split(',') if s.strip()]
    for s_name in set(h_specs):
        if s_name in ['General Ward', 'Emergency']:
            continue
        tot_sp = int(np.random.randint(12, 45))
        occ_sp = int(np.random.randint(2, tot_sp))
        records.append({
            'hospital_id': hid,
            'specialty': s_name,
            'bed_type': 'Oxygen' if np.random.rand() > 0.5 else 'Standard',
            'total_beds': tot_sp,
            'occupied_beds': occ_sp,
            'available_beds': tot_sp - occ_sp,
            'occupancy_pct': round((occ_sp / tot_sp) * 100, 2),
            'admission_fee_inr': base_fee + int(np.random.choice([0, 250, 500])),
            'last_updated': '2026-10-10T00:00:00Z'
        })

beds_df = pd.DataFrame(records)
output_path = os.path.join(data_dir, "hospital_specialty_beds.csv")
beds_df.to_csv(output_path, index=False)
print(f"Generated {len(beds_df)} specialty bed rows at {output_path}")
