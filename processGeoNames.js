var fs = require('fs');
var http = require('http');
var parse = require('csv-parse');
var through = require('through2');

var readCountries = fs.createReadStream(process.argv[2]);
var worldBank = 'http://api.worldbank.org/countries?per_page=400&format=json';

function cleanNames (str) {
  if (str == ' ') return;
  return str.trim();
}

function notNull (str) {
  return str !== null;
}

function processCountryStream (chunk, enc, callback) {
  var data = this;
  var iso = chunk[1].trim();

  var vals = chunk.map(cleanNames).filter(notNull);
  var uniqVals = vals.filter(function (el, pos) {
    return (vals.indexOf(el) == pos && isNaN(+el));
  });

  uniqVals.forEach(function (val) {
    data.push({
      iso: iso,
      val: val
    });
  });

  callback();
}

function processCountryInfo () {
  var countryInfo = {};
  var parser = parse({ delimiter: ';', comment: '#' });
  var _countryInfo = through.obj(processCountryStream);

  _countryInfo.on('data', function (data) {
    countryInfo[data.val] = data.iso;
  });

  _countryInfo.on('end', function (data) {
    getWorldBank(countryInfo);
  });

  _countryInfo.on('err', function (err) {
    console.error(err.message);
  });

  readCountries
    .pipe(parser)
    .pipe(_countryInfo);
}

function getWorldBank (countryInfo) {
  http.get(worldBank, function (res) {
    var worldBankRes = '';
    res.on('data', function (chunk) {
      worldBankRes += chunk;
    });

    res.on('end', function () {
      addWorldBankData(countryInfo, JSON.parse(worldBankRes));
    });

  }).on('error', function (err) {
    console.error(err);
  });
}

function addWorldBankData (countryInfo, worldBankData) {
  var filteredData = worldBankData[1].filter(function (country) {
    return country.region.value !== 'Aggregates';
  });

  filteredData.forEach(function (country) {
    if (!countryInfo[country.name]) {
      countryInfo[country.name] = country.id;
    }
  });

  writeFile(countryInfo);
}

function writeFile (countryInfo) {
  fs.writeFile(process.argv[3], JSON.stringify(countryInfo, null, 2), function (err) {
    if (err) console.error(err);
  });
}

processCountryInfo();
