/**
 * The login screen offers the public read-only entry only in the portfolio demo, and a refused entry
 * shows the server's message.
 */
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminLogin from '../../pages/AdminLogin';
import { resetDemoModeForTests } from '../../hooks/useDemoMode';
import { getDemoInfo } from '../../services/demoService';
import { login, demoLogin, ApiError } from '../../services/authService';

jest.mock('../../services/demoService');
jest.mock('../../services/authService', () => {
  const actual = jest.requireActual('../../services/authService');
  return { ...actual, login: jest.fn(), demoLogin: jest.fn() };
});

beforeEach(() => {
  resetDemoModeForTests();
  getDemoInfo.mockReset();
  login.mockReset();
  demoLogin.mockReset();
});

test('no viewer entry on the real store', async () => {
  getDemoInfo.mockResolvedValue({ demo: false });

  render(<AdminLogin onLogin={() => {}} />);

  await waitFor(() => expect(getDemoInfo).toHaveBeenCalled());
  expect(screen.queryByRole('button', { name: /כניסה כצופה/ })).not.toBeInTheDocument();
});

test('the demo offers "כניסה כצופה (הדגמה)", and entering reports the viewer role', async () => {
  getDemoInfo.mockResolvedValue({ demo: true, identities: [] });
  demoLogin.mockResolvedValue({ authenticated: true });
  const onLogin = jest.fn();

  render(<AdminLogin onLogin={onLogin} />);
  fireEvent.click(await screen.findByRole('button', { name: 'כניסה כצופה (הדגמה)' }));

  await waitFor(() => expect(onLogin).toHaveBeenCalledWith('viewer'));
  expect(demoLogin).toHaveBeenCalledTimes(1);
});

test('a refused viewer entry shows the server message and does not enter', async () => {
  getDemoInfo.mockResolvedValue({ demo: true, identities: [] });
  demoLogin.mockRejectedValue(new ApiError('יותר מדי ניסיונות התחברות', 429));
  const onLogin = jest.fn();

  render(<AdminLogin onLogin={onLogin} />);
  fireEvent.click(await screen.findByRole('button', { name: 'כניסה כצופה (הדגמה)' }));

  expect(await screen.findByText('יותר מדי ניסיונות התחברות')).toBeInTheDocument();
  expect(onLogin).not.toHaveBeenCalled();
});

test('the owner password login reports the owner role', async () => {
  getDemoInfo.mockResolvedValue({ demo: true, identities: [] });
  login.mockResolvedValue({ authenticated: true });
  const onLogin = jest.fn();

  render(<AdminLogin onLogin={onLogin} />);
  fireEvent.change(screen.getByPlaceholderText('סיסמה'), { target: { value: 'a-long-owner-password' } });
  fireEvent.click(screen.getByRole('button', { name: /כניסה →/ }));

  await waitFor(() => expect(onLogin).toHaveBeenCalledWith('owner'));
});
