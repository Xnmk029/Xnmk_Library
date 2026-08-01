'use strict';
const path = require('path');
const { parseJbeamFile, CCF_DIR } = require('./convert_assets.js');
const files = [
  'jbeams/ccf_bonnet.jbeam', 'jbeams/ccf_boot.jbeam', 'jbeams/ccf_bumper_F.jbeam',
  'jbeams/ccf_bumper_R.jbeam', 'jbeams/ccf_doors.jbeam', 'jbeams/ccf_fenders_F.jbeam',
  'jbeams/ccf_mirrors.jbeam', 'jbeams/ccf_sideskirts.jbeam', 'jbeams/ccf_headlights.jbeam',
  'jbeams/ccf_rearlights.jbeam', 'jbeams/ccf_lettering.jbeam', 'jbeams/ccf_quarterpanels.jbeam',
  'jbeams/ccf_apillar.jbeam', 'jbeams/ccf_rollbars.jbeam', 'jbeams/ccf_racing_seats.jbeam',
  'jbeams/ccf_intbucket_lhd.jbeam', 'jbeams/ccf_steeringwheels_lhd.jbeam',
  'jbeams/ccf_undertray.jbeam', 'jbeams/ccf_radiator.jbeam', 'jbeams/ccf_engbaycrap.jbeam',
  'jbeams/ccf_fueltank.jbeam', 'jbeams/ccf_exhaust.jbeam'
];
for (const rel of files) {
  const f = path.join(CCF_DIR, rel);
  if (!require('fs').existsSync(f)) { console.log(rel, 'MISSING'); continue; }
  try {
    const d = parseJbeamFile(f);
    console.log(rel, '->', Object.keys(d).join(', '));
  } catch (e) { console.log(rel, 'ERR', e.message.slice(0, 80)); }
}
