/**
 * Tests for the historical ("legacy") order lookup added in vJS5.38.
 *
 * Older orders (number <= 19769) get rack serial numbers and lock key numbers
 * from the middleman's pass-protected /api/legacy/order route, ONE order at a
 * time. These tests load the real src/app.js and check:
 *   - the right URL is requested, with the pass header (via makeRequest)
 *   - results are formatted exactly as before: "s1, s2 (Keys: k1)"
 *   - not-found / errors fall back to Katana; cancelled searches stay cancelled
 *   - the old full copy is removed from local storage
 *   - the old full-file download is gone
 * All data here is FAKE.
 */
const fs = require('fs');
const path = require('path');

const APP_PATH = path.join(__dirname, '..', 'src', 'app.js');
const APP_SOURCE = fs.readFileSync(APP_PATH, 'utf8');

function loadAppClass() {
  delete window.MissWooApp;
  delete window.Missive;
  window.config = undefined; // app.js then skips auto-start (logs an error we ignore)
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  // eslint-disable-next-line no-eval
  (0, eval)(APP_SOURCE);
  errorSpy.mockRestore();
  logSpy.mockRestore();
  return window.MissWooApp;
}

function makeApp(responses) {
  const App = loadAppClass();
  const app = Object.create(App.prototype);
  app.LEGACY_MAX_ORDER = 19769;
  app.apiBaseUrl = 'https://middleman.example.com';
  app.serialNumberCache = new Map();
  app.cacheExpiry = new Map();
  app.cacheConfig = { maxSerialCacheSize: 100 };
  app.requests = [];
  app.makeRequest = jest.fn(async (url, options = {}) => {
    app.requests.push(url);
    const u = new URL(url);
    const key = u.pathname + '?' + u.searchParams.toString();
    const r = responses[key];
    if (r instanceof Error) throw r;
    if (r === undefined) throw new Error(`unexpected request ${key}`);
    return typeof r === 'function' ? r(options) : r;
  });
  return app;
}

const legacy = (n) => `/api/legacy/order?order_no=${n}`;
const FOUND_2103 = { order_no: '2103', found: true, serial_numbers: ['S1'], keys: ['K1'] };

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('old full-file download is gone', () => {
  test('app.js no longer references the public export file or its parser', () => {
    expect(APP_SOURCE).not.toMatch(/sales_export_filtered\.json/);
    expect(APP_SOURCE).not.toMatch(/parse-sales-worker/);
    expect(APP_SOURCE).not.toMatch(/loadSalesExportData|getSalesExportData/);
  });
  test('cutoff is still 19769', () => {
    expect(APP_SOURCE).toMatch(/this\.LEGACY_MAX_ORDER = 19769;/);
  });
  test('cleanup of the old copy is not awaited during startup', () => {
    expect(APP_SOURCE).not.toMatch(/initPromises\.push\(\s*this\.clearOldSalesExportCopy/);
    expect(APP_SOURCE).toMatch(/this\.clearOldSalesExportCopy\(\)\.catch/);
  });
});

describe('getLegacyOrderData', () => {
  test('asks the middleman for one order and returns serials + keys', async () => {
    const app = makeApp({ [legacy(2103)]: FOUND_2103 });
    await expect(app.getLegacyOrderData(2103)).resolves.toEqual({ serialNumbers: ['S1'], keys: ['K1'] });
    expect(app.requests).toEqual(['https://middleman.example.com/api/legacy/order?order_no=2103']);
  });
  test('not in the export -> null', async () => {
    const app = makeApp({ [legacy(5)]: { order_no: '5', found: false, serial_numbers: [], keys: [] } });
    await expect(app.getLegacyOrderData('5')).resolves.toBeNull();
  });
  test('middleman error (e.g. 503) -> marked as failed, no data', async () => {
    const app = makeApp({ [legacy(7)]: new Error('HTTP 503: Service Unavailable') });
    await expect(app.getLegacyOrderData(7)).resolves.toEqual({ serialNumbers: [], keys: [], failed: true });
  });
  test('cancelled search stays cancelled (AbortError is re-thrown)', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const app = makeApp({ [legacy(8)]: abort });
    await expect(app.getLegacyOrderData(8)).rejects.toThrow('aborted');
  });
  test('bad order numbers are never sent', async () => {
    const app = makeApp({});
    for (const bad of ['', 'abc', '12a', '-1', null, undefined, '12345678901']) {
      await expect(app.getLegacyOrderData(bad)).resolves.toBeNull();
    }
    expect(app.requests).toEqual([]);
  });
  test('ignores junk values in the response', async () => {
    const app = makeApp({ [legacy(9)]: { found: true, serial_numbers: ['A', 5, '', null], keys: 'nope' } });
    await expect(app.getLegacyOrderData(9)).resolves.toEqual({ serialNumbers: ['A'], keys: [] });
  });
});

describe('formatLegacySerials (same display as before)', () => {
  const app = makeApp({});
  test.each([
    [{ serialNumbers: ['S100'], keys: ['K200'] }, 'S100 (Keys: K200)'],
    [{ serialNumbers: ['A1', 'A2', 'A3'], keys: ['K9'] }, 'A1, A2, A3 (Keys: K9)'],
    [{ serialNumbers: ['Z9'], keys: [] }, 'Z9'],
    [{ serialNumbers: ['X'], keys: ['K1', 'K2'] }, 'X (Keys: K1, K2)'],
    [{ serialNumbers: [], keys: ['K1'] }, null],
    [null, null],
  ])('%j -> %p', (input, expected) => {
    expect(app.formatLegacySerials(input)).toBe(expected);
  });
});

describe('getSerialNumber (single order)', () => {
  test('older order found in export: shows it, caches it, never asks Katana', async () => {
    const app = makeApp({ [legacy(2103)]: FOUND_2103 });
    app.getKatanaOrder = jest.fn();
    await expect(app.getSerialNumber({ number: '2103' })).resolves.toBe('S1 (Keys: K1)');
    expect(app.getKatanaOrder).not.toHaveBeenCalled();
    expect(app.serialNumberCache.get('2103')).toBe('S1 (Keys: K1)');
  });
  test('older order NOT in export: falls back to Katana', async () => {
    const app = makeApp({ [legacy(19000)]: { found: false } });
    app.getKatanaOrder = jest.fn(async () => null);
    await expect(app.getSerialNumber({ number: '19000' })).resolves.toBe('N/A');
    expect(app.getKatanaOrder).toHaveBeenCalledWith('19000');
  });
  test('middleman down: older order falls back to Katana, and "N/A" is NOT remembered', async () => {
    const app = makeApp({ [legacy(19000)]: new Error('HTTP 503') });
    app.getKatanaOrder = jest.fn(async () => null);
    await expect(app.getSerialNumber({ number: '19000' })).resolves.toBe('N/A');
    expect(app.getKatanaOrder).toHaveBeenCalled();
    expect(app.serialNumberCache.has('19000')).toBe(false);
  });
  test('genuinely not in export and not in Katana: "N/A" IS remembered (as before)', async () => {
    const app = makeApp({ [legacy(19001)]: { found: false } });
    app.getKatanaOrder = jest.fn(async () => null);
    await app.getSerialNumber({ number: '19001' });
    expect(app.serialNumberCache.get('19001')).toBe('N/A');
  });
  test('newer order (> 19769) never asks for historical data', async () => {
    const app = makeApp({});
    app.getKatanaOrder = jest.fn(async () => null);
    await app.getSerialNumber({ number: '19770' });
    expect(app.requests).toEqual([]);
  });
  test('cutoff 19769 itself uses historical data', async () => {
    const app = makeApp({ [legacy(19769)]: { found: true, serial_numbers: ['C'], keys: [] } });
    app.getKatanaOrder = jest.fn();
    await expect(app.getSerialNumber({ number: '19769' })).resolves.toBe('C');
  });
});

describe('batchGetSerialNumbers (several orders)', () => {
  test('older orders use one request each; newer go to Katana; results combined', async () => {
    const app = makeApp({
      [legacy(2103)]: FOUND_2103,
      [legacy(15000)]: { found: true, serial_numbers: ['A1', 'A2'], keys: ['K9'] },
      [legacy(18000)]: { found: false },
    });
    app.batchGetKatanaOrders = jest.fn(async (nums) => new Map(nums.map((n) => [n, null])));
    app.batchGetSerialNumbersForRows = jest.fn(async () => new Map());
    const out = await app.batchGetSerialNumbers([
      { number: '2103' }, { number: '15000' }, { number: '18000' }, { number: '20500' },
    ]);
    expect(out.get('2103')).toBe('S1 (Keys: K1)');
    expect(out.get('15000')).toBe('A1, A2 (Keys: K9)');
    // Only the not-found older order and the newer order go to Katana:
    expect(app.batchGetKatanaOrders).toHaveBeenCalledTimes(1);
    expect([...app.batchGetKatanaOrders.mock.calls[0][0]].sort()).toEqual(['18000', '20500']);
    expect(app.requests.length).toBe(3);
  });
  test('batch: failed historical lookup -> "N/A" shown but not remembered', async () => {
    const app = makeApp({ [legacy(18100)]: new Error('HTTP 503'), [legacy(18200)]: { found: false } });
    app.batchGetKatanaOrders = jest.fn(async (nums) => new Map(nums.map((n) => [n, null])));
    app.batchGetSerialNumbersForRows = jest.fn(async () => new Map());
    const out = await app.batchGetSerialNumbers([{ number: '18100' }, { number: '18200' }]);
    expect(out.get('18100')).toBe('N/A');
    expect(app.serialNumberCache.has('18100')).toBe(false);
    expect(app.serialNumberCache.get('18200')).toBe('N/A');
  });
  test('all older orders found: Katana is not called at all', async () => {
    const app = makeApp({ [legacy(2103)]: FOUND_2103 });
    app.batchGetKatanaOrders = jest.fn();
    const out = await app.batchGetSerialNumbers([{ number: '2103' }]);
    expect(out.get('2103')).toBe('S1 (Keys: K1)');
    expect(app.batchGetKatanaOrders).not.toHaveBeenCalled();
  });
});

describe('clearOldSalesExportCopy', () => {
  test('removes both old keys from local storage (web mode)', async () => {
    const app = makeApp({});
    app.isMissiveEnvironment = false;
    localStorage.setItem('sales_export_index_v1', '{"idMap":{"1":{"Keys":["secret"]}}}');
    localStorage.setItem('sales_export_timestamp', '123');
    localStorage.setItem('unrelated', 'keep');
    await app.clearOldSalesExportCopy();
    expect(localStorage.getItem('sales_export_index_v1')).toBeNull();
    expect(localStorage.getItem('sales_export_timestamp')).toBeNull();
    expect(localStorage.getItem('unrelated')).toBe('keep');
  });
  test('removes both old keys from Missive storage (Missive mode)', async () => {
    const app = makeApp({});
    app.isMissiveEnvironment = true;
    const store = { sales_export_index_v1: { idMap: {} }, sales_export_timestamp: 123 };
    window.Missive = { storeGet: jest.fn(async (k) => store[k]), storeSet: jest.fn(async () => {}) };
    await app.clearOldSalesExportCopy();
    expect(window.Missive.storeSet).toHaveBeenCalledWith('sales_export_index_v1', null);
    expect(window.Missive.storeSet).toHaveBeenCalledWith('sales_export_timestamp', null);
    delete window.Missive;
  });
  test('nothing stored -> no writes (no wasted work on every startup)', async () => {
    const app = makeApp({});
    app.isMissiveEnvironment = true;
    window.Missive = { storeGet: jest.fn(async () => null), storeSet: jest.fn(async () => {}) };
    await app.clearOldSalesExportCopy();
    expect(window.Missive.storeSet).not.toHaveBeenCalled();
    delete window.Missive;
  });
  test('a storage error does not break startup', async () => {
    const app = makeApp({});
    app.isMissiveEnvironment = true;
    window.Missive = { storeGet: jest.fn(async () => 'x'), storeSet: jest.fn(async () => { throw new Error('store down'); }) };
    await expect(app.clearOldSalesExportCopy()).resolves.toBeUndefined();
    delete window.Missive;
  });
});
