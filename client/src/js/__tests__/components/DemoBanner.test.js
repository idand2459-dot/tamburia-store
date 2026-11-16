/**
 * The demo banner appears on a positive answer from the server and nowhere else, so the real store is
 * unchanged.
 */
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import DemoBanner, { DEMO_BANNER_TEXT } from '../../components/DemoBanner';
import { resetDemoModeForTests } from '../../hooks/useDemoMode';
import { getDemoInfo } from '../../services/demoService';

jest.mock('../../services/demoService');

beforeEach(() => {
  resetDemoModeForTests();
  getDemoInfo.mockReset();
});

test('says it is a demo, with fictional data, no processing, no payment and no email', async () => {
  getDemoInfo.mockResolvedValue({ demo: true, identities: [] });

  render(<DemoBanner />);

  const note = await screen.findByRole('note');
  expect(note).toHaveTextContent(DEMO_BANNER_TEXT);
  expect(note).toHaveTextContent('אתר הדגמה');
  expect(note).toHaveTextContent('פיקטיביים');
  expect(note).toHaveTextContent('לא נגבה תשלום');
  expect(note).toHaveTextContent('לא יישלח מייל');
  expect(note).toHaveTextContent('מחירי הדגמה בלבד ואינם הצעה מסחרית');
});

test('renders nothing on the real store', async () => {
  getDemoInfo.mockResolvedValue({ demo: false });

  const { container } = render(<DemoBanner />);

  await waitFor(() => expect(getDemoInfo).toHaveBeenCalled());
  expect(container).toBeEmptyDOMElement();
});

test('renders nothing when the answer cannot be read', async () => {
  getDemoInfo.mockRejectedValue(new Error('down'));

  const { container } = render(<DemoBanner />);

  await waitFor(() => expect(getDemoInfo).toHaveBeenCalled());
  expect(container).toBeEmptyDOMElement();
});
