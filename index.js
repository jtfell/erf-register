const { parse } = require('csv-parse/sync');
const fs = require('fs');
const URL = require("url").URL;
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
var AdmZip = require("adm-zip");

const stringIsAValidUrl = (s) => {
  try {
    new URL(s);
    return true;
  } catch (err) {
    return false;
  }
};

async function downloadERF() {
  const rawRes = await fetch("https://www.cleanenergyregulator.gov.au/DocumentAssets/Documents/Emissions%20Reduction%20Fund%20Register.csv");
  const rawCsv = await rawRes.text();
  const parsedCsv = parse(rawCsv, {
    columns: true,
    skip_empty_lines: true
  });

  for (let i = 0; i < parsedCsv.length; i++) {
    const project = parsedCsv[i];

    const mappingFileUrl = project['Project Mapping File URL'];
    if (stringIsAValidUrl(mappingFileUrl)) {
      const projectOutline = await fetch(mappingFileUrl);
      project['Project Mapping File'] = await projectOutline.text();
    }

    const ceaFileUrl = project['Carbon Estimation Area mapping file URL'];
    if (stringIsAValidUrl(ceaFileUrl)) {
      const ceaArea = await fetch(ceaFileUrl);
      const zipFile = await ceaArea.arrayBuffer();

      const outputPrefix = `${__dirname}/cea_${project['Project ID']}`;
      fs.writeFileSync(`${outputPrefix}.zip`, Buffer.from(zipFile));

      const zip = new AdmZip(`${outputPrefix}.zip`);
      zip.extractAllTo(`${outputPrefix}/`, true);

      fs.unlinkSync(`${outputPrefix}.zip`);
    }
  }
  fs.writeFileSync(`${__dirname}/data.json`, JSON.stringify(parsedCsv, null, 2));
}

downloadERF();
