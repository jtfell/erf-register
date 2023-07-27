#!/usr/bin/env zx

import { parse } from 'csv-parse/sync';
import fs from 'fs';
import { URL } from 'url';
import fetch from 'node-fetch';

$.verbose = false;
const FILENAME = "Documents/Emissions%20Reduction%20Fund%20Register.csv";
const CER = `https://www.cleanenergyregulator.gov.au/DocumentAssets/${FILENAME}`;

async function processCeaFile(ceaUrl, pId) {
  const outputPrefix = `${__dirname}/cea_${pId}`;

  // Clean up old files for this project
  await $`rm -rf ${outputPrefix}/ ${outputPrefix}.geojson ${outputPrefix}.zip ${outputPrefix}.topojson`;

  // Download, unzip and convert to TopoJSON
  await $`curl ${ceaUrl} > ${outputPrefix}.zip --silent`;
  await $`unzip -qo ${outputPrefix}.zip -d ${outputPrefix}/`;
  await $`ogr2ogr ${outputPrefix}.geojson ${outputPrefix}/${pId}_CEA.shp -overwrite`;
  await $`geo2topo ${outputPrefix}.geojson -q 1e6 > ${outputPrefix}.topojson`;

  // Clean up temp files
  await $`rm -rf ${outputPrefix}/ ${outputPrefix}.geojson ${outputPrefix}.zip`;
}

const stringIsAValidUrl = (s) => {
  try {
    new URL(s);
    return true;
  } catch (err) {
    return false;
  }
};

async function processProject(project, retries=5) {
  const pId = project['Project ID'];

  const mappingFileUrl = project['Project Mapping File URL'];
  // if (stringIsAValidUrl(mappingFileUrl)) {
  //   console.log(`Mapping ${project['Project ID']}`);
  //   const projectOutline = await fetch(mappingFileUrl);
  //   project['Project Mapping File'] = await projectOutline.text();
  // }

  const ceaFileUrl = project['Carbon Estimation Area mapping file URL'];
  if (stringIsAValidUrl(ceaFileUrl)) {
    return processCeaFile(ceaFileUrl, pId);
  }
}

const rawRes = await fetch(CER);
const rawCsv = await rawRes.text();
const parsedCsv = parse(rawCsv, {
  columns: true,
  skip_empty_lines: true
});
parsedCsv.sort((a, b) => a['Project ID'] - b['Project ID']);

const CHUNK_SIZE = 30;

for (let i = 0; i < parsedCsv.length; i = i + CHUNK_SIZE) {
  console.log(`Processing (${i + 1} - ${i + CHUNK_SIZE} out of ${parsedCsv.length})`);
  await Promise.all(
    parsedCsv.slice(i, i + CHUNK_SIZE).map(p => processProject(p))
  );
}

fs.writeFileSync(`${__dirname}/data.json`, JSON.stringify(parsedCsv, null, 2));

