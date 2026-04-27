/**
 * Unit tests for the email-extraction helpers.
 *
 * These pin the behavior the production app depends on - especially the
 * CC/BCC handling that was missing prior to vJS5.20 and the
 * multi-participant TO regression that the old `.find()` shape masked.
 *
 * The module is loaded via require() (CommonJS branch of its UMD wrapper).
 */

const EmailExtract = require('../src/email-extract.js');

const CUSTOMER = 'customer@example.com';
const CUSTOMER_2 = 'someone-else@example.org';
const INTERNAL = 'agent@quikrstuff.com';
const INTERNAL_2 = 'support@QUIKRSTUFF.com';

describe('isValidEmailForSearch', () => {
  test('rejects null, undefined, empty, and non-string inputs', () => {
    expect(EmailExtract.isValidEmailForSearch(null)).toBe(false);
    expect(EmailExtract.isValidEmailForSearch(undefined)).toBe(false);
    expect(EmailExtract.isValidEmailForSearch('')).toBe(false);
    expect(EmailExtract.isValidEmailForSearch(42)).toBe(false);
    expect(EmailExtract.isValidEmailForSearch({ address: CUSTOMER })).toBe(false);
  });

  test('rejects internal @quikrstuff.com addresses regardless of case', () => {
    expect(EmailExtract.isValidEmailForSearch(INTERNAL)).toBe(false);
    expect(EmailExtract.isValidEmailForSearch(INTERNAL_2)).toBe(false);
    expect(EmailExtract.isValidEmailForSearch('Foo@Quikrstuff.com')).toBe(false);
  });

  test('rejects strings that are not well-formed emails', () => {
    expect(EmailExtract.isValidEmailForSearch('not-an-email')).toBe(false);
    expect(EmailExtract.isValidEmailForSearch('a@b')).toBe(false);
    expect(EmailExtract.isValidEmailForSearch('@example.com')).toBe(false);
    expect(EmailExtract.isValidEmailForSearch('foo @bar.com')).toBe(false);
  });

  test('accepts well-formed external customer emails', () => {
    expect(EmailExtract.isValidEmailForSearch(CUSTOMER)).toBe(true);
    expect(EmailExtract.isValidEmailForSearch(CUSTOMER_2)).toBe(true);
    expect(EmailExtract.isValidEmailForSearch('a.b+tag@sub.example.co.uk')).toBe(true);
  });
});

describe('extractAllEmailsFromString', () => {
  test('returns [] for empty / non-string input', () => {
    expect(EmailExtract.extractAllEmailsFromString(null)).toEqual([]);
    expect(EmailExtract.extractAllEmailsFromString('')).toEqual([]);
    expect(EmailExtract.extractAllEmailsFromString(123)).toEqual([]);
  });

  test('returns every email-shaped substring in document order', () => {
    const text = `Hi ${INTERNAL}, please contact ${CUSTOMER}, cc ${CUSTOMER_2}.`;
    expect(EmailExtract.extractAllEmailsFromString(text)).toEqual([
      INTERNAL, CUSTOMER, CUSTOMER_2,
    ]);
  });

  test('does not filter internal addresses (caller decides)', () => {
    expect(EmailExtract.extractAllEmailsFromString(INTERNAL)).toEqual([INTERNAL]);
  });
});

describe('extractEmailFromString', () => {
  test('returns null when no customer email is present', () => {
    expect(EmailExtract.extractEmailFromString(`Only ${INTERNAL} here`)).toBeNull();
    expect(EmailExtract.extractEmailFromString('no email at all')).toBeNull();
  });

  test('skips internal addresses and returns the first customer email', () => {
    const text = `${INTERNAL_2}, ${CUSTOMER}, ${CUSTOMER_2}`;
    expect(EmailExtract.extractEmailFromString(text)).toBe(CUSTOMER);
  });
});

describe('extractEmailFromParticipants', () => {
  test('returns null for empty / non-array input', () => {
    expect(EmailExtract.extractEmailFromParticipants(null)).toBeNull();
    expect(EmailExtract.extractEmailFromParticipants([])).toBeNull();
    expect(EmailExtract.extractEmailFromParticipants('not an array')).toBeNull();
  });

  test('prefers TO recipients over FROM and over unspecified', () => {
    const ps = [
      { role: 'from', email: CUSTOMER_2 },
      { role: 'to', email: CUSTOMER },
      { role: 'cc', email: 'another@example.net' },
    ];
    expect(EmailExtract.extractEmailFromParticipants(ps)).toBe(CUSTOMER);
  });

  test('iterates ALL participants in a tier before falling through (regression for find() bug)', () => {
    // First TO is internal; second TO is the customer. The pre-fix
    // implementation used participants.find(p => p.role === 'to') which
    // returned ONLY the first match and never checked the second.
    const ps = [
      { role: 'to', email: INTERNAL },
      { role: 'to', email: CUSTOMER },
      { role: 'from', email: 'agent@elsewhere.com' },
    ];
    expect(EmailExtract.extractEmailFromParticipants(ps)).toBe(CUSTOMER);
  });

  test('falls through to FROM when no TO matches', () => {
    const ps = [
      { role: 'to', email: INTERNAL },
      { role: 'from', email: CUSTOMER },
    ];
    expect(EmailExtract.extractEmailFromParticipants(ps)).toBe(CUSTOMER);
  });

  test('falls through to participants without a recognized role last', () => {
    const ps = [
      { role: 'to', email: INTERNAL },
      { role: 'from', email: INTERNAL_2 },
      { email: CUSTOMER },
    ];
    expect(EmailExtract.extractEmailFromParticipants(ps)).toBe(CUSTOMER);
  });

  test('reads contact.email and contact.emails (string + object entries)', () => {
    expect(EmailExtract.extractEmailFromParticipants([
      { role: 'to', contact: { email: CUSTOMER } },
    ])).toBe(CUSTOMER);

    expect(EmailExtract.extractEmailFromParticipants([
      { role: 'to', contact: { emails: [INTERNAL, CUSTOMER] } },
    ])).toBe(CUSTOMER);

    expect(EmailExtract.extractEmailFromParticipants([
      { role: 'to', contact: { emails: [{ email: INTERNAL }, { email: CUSTOMER }] } },
    ])).toBe(CUSTOMER);
  });

  test('returns null when every participant is internal or empty', () => {
    expect(EmailExtract.extractEmailFromParticipants([
      { role: 'to', email: INTERNAL },
      { role: 'from', email: INTERNAL_2 },
    ])).toBeNull();
  });
});

describe('extractEmailFromData', () => {
  test('returns null for null / undefined / array inputs', () => {
    expect(EmailExtract.extractEmailFromData(null)).toBeNull();
    expect(EmailExtract.extractEmailFromData(undefined)).toBeNull();
    expect(EmailExtract.extractEmailFromData([])).toBeNull();
    expect(EmailExtract.extractEmailFromData(['conv-id'])).toBeNull();
  });

  test('reads documented latest_message.from_field', () => {
    expect(EmailExtract.extractEmailFromData({
      from_field: { address: CUSTOMER, name: 'A Customer' },
    })).toBe(CUSTOMER);
  });

  test('reads documented latest_message.to_fields', () => {
    expect(EmailExtract.extractEmailFromData({
      from_field: { address: INTERNAL },
      to_fields: [{ address: INTERNAL_2 }, { address: CUSTOMER }],
    })).toBe(CUSTOMER);
  });

  test('CC-only payload now resolves the customer (vJS5.20 fix)', () => {
    expect(EmailExtract.extractEmailFromData({
      from_field: { address: INTERNAL },
      to_fields: [{ address: INTERNAL_2 }],
      cc_fields: [{ address: CUSTOMER }],
    })).toBe(CUSTOMER);
  });

  test('BCC-only payload now resolves the customer (vJS5.20 fix)', () => {
    expect(EmailExtract.extractEmailFromData({
      from_field: { address: INTERNAL },
      to_fields: [{ address: INTERNAL_2 }],
      bcc_fields: [{ address: CUSTOMER }],
    })).toBe(CUSTOMER);
  });

  test('messages[].cc (legacy short-key shape) now resolves the customer', () => {
    expect(EmailExtract.extractEmailFromData({
      messages: [{
        from: { email: INTERNAL },
        to: [{ email: INTERNAL_2 }],
        cc: [{ email: CUSTOMER }],
      }],
    })).toBe(CUSTOMER);
  });

  test('messages[].bcc_fields (documented long-key shape) resolves the customer', () => {
    expect(EmailExtract.extractEmailFromData({
      messages: [{
        from_field: { address: INTERNAL },
        to_fields: [{ address: INTERNAL_2 }],
        bcc_fields: [{ address: CUSTOMER }],
      }],
    })).toBe(CUSTOMER);
  });

  test('reads contact.emails when present', () => {
    expect(EmailExtract.extractEmailFromData({
      contact: { emails: [INTERNAL, CUSTOMER] },
    })).toBe(CUSTOMER);

    expect(EmailExtract.extractEmailFromData({
      contact: { email: CUSTOMER },
    })).toBe(CUSTOMER);
  });

  test('reads top-level email_addresses array', () => {
    expect(EmailExtract.extractEmailFromData({
      email_addresses: [{ address: INTERNAL }, { address: CUSTOMER }],
    })).toBe(CUSTOMER);
  });

  test('falls through to thread / participants when header fields are absent', () => {
    expect(EmailExtract.extractEmailFromData({
      thread: { participants: [{ role: 'to', email: CUSTOMER }] },
    })).toBe(CUSTOMER);
  });

  test('extracts customer email from free-text body fields', () => {
    expect(EmailExtract.extractEmailFromData({
      body: `Reply-to: ${CUSTOMER}`,
    })).toBe(CUSTOMER);
  });

  test('returns null when every address is internal or invalid', () => {
    expect(EmailExtract.extractEmailFromData({
      from_field: { address: INTERNAL },
      to_fields: [{ address: INTERNAL_2 }],
      cc_fields: [{ address: 'agent3@quikrstuff.com' }],
      bcc_fields: [{ address: 'invalid-not-an-email' }],
    })).toBeNull();
  });

  test('recursive last-ditch scan finds email buried in nested strings', () => {
    expect(EmailExtract.extractEmailFromData({
      meta: { notes: { line1: `Customer wrote: ${CUSTOMER}` } },
    })).toBe(CUSTOMER);
  });
});

describe('getCustomerEmailFromAPI', () => {
  const fakeConvs = [{ id: 'c1' }];

  test('returns null for empty / non-array conversations', () => {
    expect(EmailExtract.getCustomerEmailFromAPI(null, makeMissive([]))).toBeNull();
    expect(EmailExtract.getCustomerEmailFromAPI([], makeMissive([]))).toBeNull();
    expect(EmailExtract.getCustomerEmailFromAPI('not an array', makeMissive([]))).toBeNull();
  });

  test('returns null when missive is missing or lacks getEmailAddresses', () => {
    expect(EmailExtract.getCustomerEmailFromAPI(fakeConvs, null)).toBeNull();
    expect(EmailExtract.getCustomerEmailFromAPI(fakeConvs, {})).toBeNull();
    expect(EmailExtract.getCustomerEmailFromAPI(fakeConvs, { getEmailAddresses: 'not a fn' })).toBeNull();
  });

  test('swallows synchronous errors from the API call', () => {
    const missive = {
      getEmailAddresses: () => { throw new Error('boom'); },
    };
    expect(EmailExtract.getCustomerEmailFromAPI(fakeConvs, missive)).toBeNull();
  });

  test('returns null when API yields empty array', () => {
    expect(EmailExtract.getCustomerEmailFromAPI(fakeConvs, makeMissive([]))).toBeNull();
  });

  test('returns null when every returned address is internal', () => {
    const missive = makeMissive([{ address: INTERNAL }, { address: INTERNAL_2 }]);
    expect(EmailExtract.getCustomerEmailFromAPI(fakeConvs, missive)).toBeNull();
  });

  test('returns first customer-eligible address', () => {
    const missive = makeMissive([
      { address: INTERNAL, name: 'Agent' },
      { address: CUSTOMER, name: 'Customer' },
      { address: CUSTOMER_2 },
    ]);
    expect(EmailExtract.getCustomerEmailFromAPI(fakeConvs, missive)).toBe(CUSTOMER);
  });

  test('passes the conversations argument through to Missive.getEmailAddresses', () => {
    const spy = jest.fn(() => [{ address: CUSTOMER }]);
    const missive = { getEmailAddresses: spy };
    EmailExtract.getCustomerEmailFromAPI(fakeConvs, missive);
    expect(spy).toHaveBeenCalledWith(fakeConvs);
  });
});

function makeMissive(addressesToReturn) {
  return {
    getEmailAddresses: jest.fn(() => addressesToReturn),
  };
}
