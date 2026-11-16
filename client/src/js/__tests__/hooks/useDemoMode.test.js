/**
 * useDemoMode reads GET /api/demo once and keeps the answer for the page. Until the answer arrives, and
 * whenever it cannot be read, the site is the real store: the demo is shown only on a positive answer.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { useDemoMode, resetDemoModeForTests } from '../../hooks/useDemoMode';
import { getDemoInfo } from '../../services/demoService';

jest.mock('../../services/demoService');

const IDENTITIES = [{ key: 'demo-1', customer_name: 'דנה דמו' }];

beforeEach(() => {
  resetDemoModeForTests();
  getDemoInfo.mockReset();
});

test('is not the demo until the server says so', async () => {
  getDemoInfo.mockReturnValue(new Promise(() => {}));

  const { result } = renderHook(() => useDemoMode());

  expect(result.current).toEqual({ demo: false, identities: [] });
});

test('a positive answer gives demo mode and the identities', async () => {
  getDemoInfo.mockResolvedValue({ demo: true, identities: IDENTITIES });

  const { result } = renderHook(() => useDemoMode());

  await waitFor(() => expect(result.current.demo).toBe(true));
  expect(result.current.identities).toEqual(IDENTITIES);
});

test('{ demo: false } stays the real store', async () => {
  getDemoInfo.mockResolvedValue({ demo: false });

  const { result } = renderHook(() => useDemoMode());

  await waitFor(() => expect(getDemoInfo).toHaveBeenCalled());
  expect(result.current.demo).toBe(false);
});

test('an unreadable answer is the real store, and is asked again on the next mount', async () => {
  getDemoInfo.mockRejectedValueOnce(new Error('down')).mockResolvedValue({ demo: true, identities: IDENTITIES });

  const first = renderHook(() => useDemoMode());
  await waitFor(() => expect(getDemoInfo).toHaveBeenCalledTimes(1));
  expect(first.result.current.demo).toBe(false);
  first.unmount();

  const second = renderHook(() => useDemoMode());
  await waitFor(() => expect(second.result.current.demo).toBe(true));
  expect(getDemoInfo).toHaveBeenCalledTimes(2);
});

test('the answer is read once for every component on the page', async () => {
  getDemoInfo.mockResolvedValue({ demo: true, identities: IDENTITIES });

  const a = renderHook(() => useDemoMode());
  const b = renderHook(() => useDemoMode());

  await waitFor(() => expect(a.result.current.demo).toBe(true));
  await waitFor(() => expect(b.result.current.demo).toBe(true));
  expect(getDemoInfo).toHaveBeenCalledTimes(1);
});
