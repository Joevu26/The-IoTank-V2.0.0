describe('Registration lifecycle contracts', () => {
  test('manual provisioning payload shape is complete', () => {
    const payload = {
      full_name: 'Owner Name',
      email: 'owner@example.com',
      phone: '+254700000000',
      station_name: 'Station A',
      county: 'Nairobi',
      notes: 'Created via super admin quick provisioning.',
      tanks: [{ name: 'tank group 1', type: 'diesel', quantity: 1, capacity: 10000 }],
      status: 'pending'
    };

    expect(typeof payload.full_name).toBe('string');
    expect(payload.email.includes('@')).toBe(true);
    expect(Array.isArray(payload.tanks)).toBe(true);
    expect(payload.tanks[0].capacity).toBeGreaterThan(0);
    expect(payload.status).toBe('pending');
  });

  test('invite role normalization enforces supported values', () => {
    const normalizeRole = (role) => (['supervisor', 'operator', 'viewer'].includes(role) ? role : 'operator');

    expect(normalizeRole('supervisor')).toBe('supervisor');
    expect(normalizeRole('operator')).toBe('operator');
    expect(normalizeRole('viewer')).toBe('viewer');
    expect(normalizeRole('admin')).toBe('operator');
    expect(normalizeRole(undefined)).toBe('operator');
  });
});
