/**
 * Unit tests for the order-grouping helper used by the name-search path
 * in `src/app.js`. The function is pure (no DOM, no `this`) so it can run
 * directly under jest in node via the CommonJS branch of its UMD wrapper.
 *
 * These tests pin the contract that `searchOrdersByName` relies on:
 *   - group by normalized billing email
 *   - sort customers by most-recent order date desc
 *   - cap at 5 customers, surface a `truncated` flag if more existed
 *   - skip orders missing a billing email (fail loudly, don't crash)
 */

const OrderGroup = require('../src/order-group.js');

function order(overrides) {
  return Object.assign(
    {
      id: 1,
      number: '1',
      date_created: '2026-01-01T00:00:00',
      billing: { email: 'a@example.com', first_name: 'Alice', last_name: 'Adams' },
      customer_id: 0,
    },
    overrides,
  );
}

describe('groupOrdersByCustomer', () => {
  test('returns empty result for null / non-array / empty input', () => {
    expect(OrderGroup.groupOrdersByCustomer(null)).toEqual({ customers: [], truncated: false });
    expect(OrderGroup.groupOrdersByCustomer(undefined)).toEqual({ customers: [], truncated: false });
    expect(OrderGroup.groupOrdersByCustomer('not an array')).toEqual({ customers: [], truncated: false });
    expect(OrderGroup.groupOrdersByCustomer([])).toEqual({ customers: [], truncated: false });
  });

  test('groups multiple orders from the same billing email into one customer', () => {
    const result = OrderGroup.groupOrdersByCustomer([
      order({ id: 1, date_created: '2026-01-01T00:00:00' }),
      order({ id: 2, date_created: '2026-03-15T00:00:00' }),
      order({ id: 3, date_created: '2026-02-10T00:00:00' }),
    ]);

    expect(result.customers).toHaveLength(1);
    expect(result.customers[0]).toEqual(
      expect.objectContaining({
        email: 'a@example.com',
        displayName: 'Alice Adams',
        orderCount: 3,
        mostRecentDate: '2026-03-15T00:00:00',
      }),
    );
    expect(result.customers[0].orders).toHaveLength(3);
    expect(result.truncated).toBe(false);
  });

  test('separates orders with different billing emails into different customers', () => {
    const result = OrderGroup.groupOrdersByCustomer([
      order({ id: 1, billing: { email: 'a@example.com', first_name: 'A', last_name: 'One' } }),
      order({ id: 2, billing: { email: 'b@example.com', first_name: 'B', last_name: 'Two' } }),
    ]);

    expect(result.customers).toHaveLength(2);
    const emails = result.customers.map((c) => c.email).sort();
    expect(emails).toEqual(['a@example.com', 'b@example.com']);
  });

  test('normalizes billing email (lowercase + trim) when grouping', () => {
    const result = OrderGroup.groupOrdersByCustomer([
      order({ id: 1, billing: { email: 'Foo@Example.com', first_name: 'F', last_name: 'B' } }),
      order({ id: 2, billing: { email: '  foo@example.com  ', first_name: 'F', last_name: 'B' } }),
      order({ id: 3, billing: { email: 'FOO@EXAMPLE.COM', first_name: 'F', last_name: 'B' } }),
    ]);

    expect(result.customers).toHaveLength(1);
    expect(result.customers[0].email).toBe('foo@example.com');
    expect(result.customers[0].orderCount).toBe(3);
  });

  test('sorts customers by most-recent order date descending', () => {
    const result = OrderGroup.groupOrdersByCustomer([
      order({ id: 1, date_created: '2026-01-01T00:00:00', billing: { email: 'oldest@example.com', first_name: 'O', last_name: 'X' } }),
      order({ id: 2, date_created: '2026-05-01T00:00:00', billing: { email: 'newest@example.com', first_name: 'N', last_name: 'X' } }),
      order({ id: 3, date_created: '2026-03-01T00:00:00', billing: { email: 'middle@example.com', first_name: 'M', last_name: 'X' } }),
    ]);

    expect(result.customers.map((c) => c.email)).toEqual([
      'newest@example.com',
      'middle@example.com',
      'oldest@example.com',
    ]);
  });

  test('uses the most-recent order for displayName when a customer changes names', () => {
    // Edge case: same email used with different billing names on different
    // orders. We pick the name from the most-recent order because that's the
    // most likely current preference.
    const result = OrderGroup.groupOrdersByCustomer([
      order({ id: 1, date_created: '2026-01-01T00:00:00', billing: { email: 'x@example.com', first_name: 'Old', last_name: 'Name' } }),
      order({ id: 2, date_created: '2026-06-01T00:00:00', billing: { email: 'x@example.com', first_name: 'New', last_name: 'Name' } }),
    ]);

    expect(result.customers).toHaveLength(1);
    expect(result.customers[0].displayName).toBe('New Name');
    expect(result.customers[0].mostRecentDate).toBe('2026-06-01T00:00:00');
  });

  test('caps customers at 5 and sets truncated=true when more existed', () => {
    const orders = [];
    for (let i = 1; i <= 7; i++) {
      orders.push(order({
        id: i,
        date_created: `2026-0${i}-01T00:00:00`,
        billing: { email: `c${i}@example.com`, first_name: `C${i}`, last_name: 'Z' },
      }));
    }

    const result = OrderGroup.groupOrdersByCustomer(orders);

    expect(result.customers).toHaveLength(5);
    expect(result.truncated).toBe(true);
    expect(result.customers.map((c) => c.email)).toEqual([
      'c7@example.com',
      'c6@example.com',
      'c5@example.com',
      'c4@example.com',
      'c3@example.com',
    ]);
  });

  test('truncated=false when exactly 5 customers exist', () => {
    const orders = [];
    for (let i = 1; i <= 5; i++) {
      orders.push(order({
        id: i,
        billing: { email: `c${i}@example.com`, first_name: `C${i}`, last_name: 'Z' },
      }));
    }
    const result = OrderGroup.groupOrdersByCustomer(orders);
    expect(result.customers).toHaveLength(5);
    expect(result.truncated).toBe(false);
  });

  test('skips orders missing a billing email but still groups the valid ones', () => {
    // Fail loudly: we don't silently make up an identity for orders with no
    // billing email. They're dropped from the picker (caller can still find
    // them via order-ID search if needed).
    const result = OrderGroup.groupOrdersByCustomer([
      order({ id: 1 }),
      order({ id: 2, billing: { email: '', first_name: 'No', last_name: 'Email' } }),
      order({ id: 3, billing: null }),
      order({ id: 4, billing: undefined }),
      order({ id: 5 }),
    ]);

    expect(result.customers).toHaveLength(1);
    expect(result.customers[0].email).toBe('a@example.com');
    expect(result.customers[0].orderCount).toBe(2);
  });

  test('handles missing first_name / last_name gracefully', () => {
    const result = OrderGroup.groupOrdersByCustomer([
      order({ billing: { email: 'x@example.com', first_name: '', last_name: '' } }),
    ]);
    expect(result.customers[0].displayName).toBe('');

    const result2 = OrderGroup.groupOrdersByCustomer([
      order({ billing: { email: 'x@example.com', first_name: 'Solo' } }),
    ]);
    expect(result2.customers[0].displayName).toBe('Solo');

    const result3 = OrderGroup.groupOrdersByCustomer([
      order({ billing: { email: 'x@example.com', last_name: 'Last' } }),
    ]);
    expect(result3.customers[0].displayName).toBe('Last');
  });

  test('trims whitespace inside displayName', () => {
    const result = OrderGroup.groupOrdersByCustomer([
      order({ billing: { email: 'x@example.com', first_name: '  Padded  ', last_name: '  Name  ' } }),
    ]);
    expect(result.customers[0].displayName).toBe('Padded Name');
  });

  test('preserves order list inside each customer group', () => {
    const result = OrderGroup.groupOrdersByCustomer([
      order({ id: 1, number: '101', billing: { email: 'a@example.com', first_name: 'A', last_name: 'A' } }),
      order({ id: 2, number: '102', billing: { email: 'a@example.com', first_name: 'A', last_name: 'A' } }),
    ]);
    expect(result.customers[0].orders.map((o) => o.id)).toEqual([1, 2]);
  });
});
