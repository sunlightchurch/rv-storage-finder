import assert from 'node:assert/strict';
import { runSearch } from '../src/lib/geo.mjs';
import { buildSearchData, loadZcta } from '../src/lib/places.mjs';

const zcta = loadZcta();
const data = buildSearchData(zcta);

function top(result) {
  return {
    city: result.cities[0]?.item.label,
    cityId: result.cities[0]?.item.id,
    cityMiles: result.cities[0]?.miles,
    facility: result.facilities[0]?.item.name,
    facilityCity: result.facilities[0]?.item.cityId,
    facilityPlace: result.facilities[0]?.item.place,
    miles: result.facilities[0]?.miles,
    outside: result.outside,
    how: result.how,
  };
}

const port = runSearch('34986', data, zcta);
assert.equal(port.kind, 'zip');
assert.equal(port.known, true);
assert.equal(port.outside, false);
assert.equal(port.cities[0].item.id, 'port-st-lucie-fl', JSON.stringify(top(port)));
assert.equal(port.facilities[0].item.cityId, 'port-st-lucie-fl', JSON.stringify(top(port)));
assert.ok(port.facilities[0].miles < port.cities[1].miles || port.cities[1].item.id !== 'port-st-lucie-fl');
for (let i = 1; i < port.facilities.length; i += 1) {
  assert.ok(port.facilities[i].miles >= port.facilities[i - 1].miles);
}

const phoenix = runSearch('85001', data, zcta);
assert.equal(phoenix.kind, 'zip');
assert.equal(phoenix.known, true);
assert.equal(phoenix.how, 'prefix');
assert.equal(phoenix.outside, false);
assert.equal(phoenix.cities[0].item.id, 'phoenix-az', JSON.stringify(top(phoenix)));
assert.equal(phoenix.facilities[0].item.cityId, 'phoenix-az', JSON.stringify(top(phoenix)));
assert.ok(phoenix.facilities[0].miles < 15, JSON.stringify(top(phoenix)));

const far = runSearch('99501', data, zcta);
assert.equal(far.known, true);
assert.equal(far.outside, true);
assert.ok(far.facilities.length > 0);
assert.ok(far.facilities[0].miles > 50);

const tampa = runSearch('Tampa', data, zcta);
assert.equal(tampa.redirect?.id, 'tampa-fl');
const saint = runSearch('Port Saint Lucie', data, zcta);
assert.equal(saint.redirect?.id, 'port-st-lucie-fl');

console.log('ZIP search tests passed.');
console.log('34986', top(port));
console.log('85001', top(phoenix));
