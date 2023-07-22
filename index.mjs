#!/usr/bin/env zx

import { parse } from 'csv-parse/sync';
import fs from 'fs';
import { URL } from 'url';
import fetch from 'node-fetch';

const stringIsAValidUrl = (s) => {
  try {
    new URL(s);
    return true;
  } catch (err) {
    return false;
  }
};

$.verbose = false;

async function downloadERF() {
  const rawRes = await fetch("https://www.cleanenergyregulator.gov.au/DocumentAssets/Documents/Emissions%20Reduction%20Fund%20Register.csv");
  const rawCsv = await rawRes.text();
  const parsedCsv = parse(rawCsv, {
    columns: true,
    skip_empty_lines: true
  });

  const CHUNK_SIZE = 30;

  for (let i = 0; i < parsedCsv.length; i = i + CHUNK_SIZE) {
    console.log(`Processing (${i + 1} - ${i + CHUNK_SIZE} out of ${parsedCsv.length})`);
    await Promise.all(
      parsedCsv.slice(i, i + CHUNK_SIZE).map(p => processProject(p))
    );
  }
  fs.writeFileSync(`${__dirname}/data.json`, JSON.stringify(parsedCsv, null, 2));
}

async function processCeaFile(ceaUrl, outputPrefix, pId) {
  // Clean up old files for this project
  await $`rm -rf ${outputPrefix}/ ${outputPrefix}.geojson ${outputPrefix}.zip`;

  await $`curl ${ceaUrl} > ${outputPrefix}.zip --silent`;
  await $`unzip -qo ${outputPrefix}.zip -d ${outputPrefix}/`;
  await $`ogr2ogr ${outputPrefix}.geojson ${outputPrefix}/${pId}_CEA.shp -overwrite`;
  await $`geo2topo ${outputPrefix}.geojson > ${outputPrefix}.topojson`;

  // Clean up temp files
  await $`rm -rf ${outputPrefix}/ ${outputPrefix}.geojson ${outputPrefix}.zip`;
}

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
    const outputPrefix = `${__dirname}/cea_${pId}`;

    return processCeaFile(ceaFileUrl, outputPrefix, pId);
  }
}

downloadERF();