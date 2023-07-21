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

  const CHUNK_SIZE = 20;

  for (let i = 0; i < parsedCsv.length; i = i + CHUNK_SIZE) {

    console.log(`Processing (${i + 1} - ${i + CHUNK_SIZE} out of ${parsedCsv.length})`);
    await Promise.all(
      parsedCsv.slice(i, i + CHUNK_SIZE).map(p => processProject(p))
    );
  }
  fs.writeFileSync(`${__dirname}/data.json`, JSON.stringify(parsedCsv, null, 2));
}

async function processProject(project, retry=false) {
  const mappingFileUrl = project['Project Mapping File URL'];
  // if (stringIsAValidUrl(mappingFileUrl)) {
  //   console.log(`Mapping ${project['Project ID']}`);
  //   const projectOutline = await fetch(mappingFileUrl);
  //   project['Project Mapping File'] = await projectOutline.text();
  // }

  const ceaFileUrl = project['Carbon Estimation Area mapping file URL'];
  if (stringIsAValidUrl(ceaFileUrl)) {
    let zipFile = null;
    try {
      const ceaArea = await fetch(ceaFileUrl);
      zipFile = await ceaArea.arrayBuffer();
    } catch (e) {
      if (retry) {
        throw e;
      } else {
        console.log(`Retrying ${project['Project ID']}`);
        return await processProject(project, true);
      }
    }


    const outputPrefix = `${__dirname}/cea_${project['Project ID']}`;
    return new Promise((resolve, reject) => {
      fs.writeFile(`${outputPrefix}.zip`, Buffer.from(zipFile), (err) => {
        if (err) {
          return reject(err);
        }

        const zip = new AdmZip(`${outputPrefix}.zip`);
        zip.extractAllTo(`${outputPrefix}/`, true);

        fs.unlink(`${outputPrefix}.zip`, (err2) => {
          if (err2) return reject(err2);
          console.log(`CEA ${project['Project ID']} extracted`);
          return resolve();
        });
      })
    });
  } else {
    return Promise.resolve();
  }
}

downloadERF();
