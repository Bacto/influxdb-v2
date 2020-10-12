const fetch = require('node-fetch');

class Influxdb {
  constructor({ host, protocol, port, token, fetchOptions = {} }) {
    if (!host) {
      throw Error('`host` is required');
    }
    this._host = host;

    const protocols = [ undefined, 'http', 'https' ];
    if (protocols.indexOf(protocol) === -1) {
      throw Error('`protocol` should defined to `http` or `https`');
    }
    this._protocol = protocol || 'https';

    if (port && !(port >= 1 && port <= 65535)) {
      throw Error('`port` should between 1 and 65535');
    }
    this._port = port || (this._protocol === 'https' ? 443 : 80);

    if (!token) {
      throw Error('`token` is required');
    }
    this._token = token;
    this._fetchOptions = fetchOptions;
  }

  async _fetch({ route, method, params, json, body, responseType }) {
    const baseUrl = `${this._protocol}://${this._host}:${this._port}/api/v2`;
    const paramsString = Object.keys(params)
      .filter(key => params[key] !== undefined)
      .map(key => key + '=' + encodeURIComponent(params[key]))
      .join('&');
    const response = await fetch(
      baseUrl + route + '?' + paramsString,
      {
        method,
        headers: {
          'Content-Type': json ? 'application/json' : 'text/plain; charset=utf-8',
          'Authorization': `Token ${this._token}`
        },
        body: json ? JSON.stringify(body) : body,
        ...this._fetchOptions
      });


    if (!response.ok) { // not response.status >= 200 && response.status < 300
      const responseText = await response.text();
      throw Error(`${response.status} on ${response.url}: ${responseText}`);
    }
    return await response[responseType || 'text']();
  }

  _csvParse(plainText) {
    return plainText.split(/\r\n\r\n/)
      .filter(partRaw => partRaw !== '')
      .map(partRaw => {
        const lines = partRaw.split(/\r\n,/);
        const header = lines[0].split(/,/).filter(value => value !== '');

        return lines
          .filter((line, index) => index > 0)
          .map(line => line
            .split(/,/)
            .map((value, index) => {
              const key = header[index];

              if (key === '_value') {
                value = parseFloat(value);
              }
              else if (key === '_start' || key === '_stop' || key === '_time') {
                value = new Date(value);
              }

              return { [key]: value };
            })
            .reduce((accumulator, value) => ({ ...accumulator, ...value }), {})
          );
      });
  }

  async query({ org, orgID, csv }, { query }) {
    const result = await this._fetch({
      route: '/query',
      method: 'POST',
      json: true,
      params: { org, orgID },
      body: { query }
    });
    return csv ? result : this._csvParse(result);
  }

  async write({ org, orgID, bucket, precision }, lines) {
    const body = lines
      .map(({ measurement, tags = {}, fields, timestamp }) => {
        const tagsString = Object.keys(tags)
          .map(tagKey => `,${tagKey}=${tags[tagKey]}`)
          .join('');

        const fieldsString = Object.keys(fields)
          .map(fieldKey => `${fieldKey}=${typeof(fields[fieldKey]) === 'string' ? `"${fields[fieldKey]}"` : fields[fieldKey]}`)
          .join(',');

        timestamp = timestamp ? ' ' + timestamp : '';
        // `<measurement>[,<tag_key>=<tag_value>[,<tag_key>=<tag_value>]] <field_key>=<field_value>[,<field_key>=<field_value>] [<timestamp>]`
        return `${measurement}${tagsString} ${fieldsString}${timestamp}`;
      })
      .join('\n');

    return await this._fetch({
      route: '/write',
      method: 'POST',
      params: { org, orgID, bucket, precision },
      body
    });
  }
};


module.exports = Influxdb;
