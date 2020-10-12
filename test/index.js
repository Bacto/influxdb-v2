const Influxdb = require('../src/');
require('dotenv').config();

(async () => {
  const influxdb = new Influxdb({
    host: process.env.INFLUXDB_HOST,
    protocol: process.env.INFLUXDB_PROTOCOL,
    port: process.env.INFLUXDB_PORT,
    token: process.env.INFLUXDB_TOKEN
  });

  const org = 'a';
  const bucket = 'a';

  const queryResult = await influxdb.query(
    { org, csv: false },
    { query: 'from(bucket: "a") |> range(start: -1m) |> filter(fn: (r) => r.tagname1 == "myTagvalue1")' }
  );
  console.log(queryResult);


  await influxdb.write(
    {
      org,
      bucket,
      precision: 'ms'
    },
    [{
      measurement: 'myMeasurement2',
      tags: {
        tagname1: 'myTagvalue1',
        tagname2: 'myTagvalue2'
      },
      fields: {
        fieldname1: 12.34,
        fieldname2: 23.45,
        fieldname3: true,
        fieldname4: 'string',
      },
      timestamp: Date.now()
    }]
  );

})().catch(error => {
  console.error('');
  console.error('🐞 An error occurred!');
  console.error(error);
  process.exit(1);
});
