/**
 * Public review submission is off in the portfolio demo (the server answers 403 demo_disabled): the
 * "write a review" button is not drawn there, and is on the real store.
 */
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import ReviewsCarousel from '../../../features/catalog/ReviewsCarousel';
import { resetDemoModeForTests } from '../../../hooks/useDemoMode';
import { getDemoInfo } from '../../../services/demoService';
import { getReviews } from '../../../services/reviewService';

jest.mock('../../../services/demoService');
jest.mock('../../../services/reviewService');

beforeEach(() => {
  resetDemoModeForTests();
  getDemoInfo.mockReset();
  getReviews.mockReset();
  getReviews.mockResolvedValue([
    { id: 1, reviewer_name: 'לקוח לדוגמה', rating: 5, text: 'שירות מצוין', type: 'store', created_at: '2026-10-01' },
  ]);
});

test('the real store has the "כתוב ביקורת" button', async () => {
  getDemoInfo.mockResolvedValue({ demo: false });

  render(<ReviewsCarousel />);

  expect(await screen.findByRole('button', { name: /כתוב ביקורת/ })).toBeInTheDocument();
});

test('the demo shows the curated reviews and no button to write one', async () => {
  getDemoInfo.mockResolvedValue({ demo: true, identities: [] });

  render(<ReviewsCarousel />);

  expect((await screen.findAllByText('שירות מצוין')).length).toBeGreaterThan(0);
  await waitFor(() => expect(getDemoInfo).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByRole('button', { name: /כתוב ביקורת/ })).not.toBeInTheDocument());
});
