/**
 * Image uploads are off in the portfolio demo for everyone (the server answers 403 demo_disabled): the
 * product form does not draw the upload control there, and does on the real store.
 */
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProductFormTab from '../../../pages/admin/ProductFormTab';
import { resetDemoModeForTests } from '../../../hooks/useDemoMode';
import { getDemoInfo } from '../../../services/demoService';

jest.mock('../../../services/demoService');

/** The form for a new product. */
function renderForm() {
  return render(
    <MemoryRouter>
      <ProductFormTab
        editingProduct={null} onCreate={() => {}} onUpdate={() => {}} onToggleActive={() => {}}
        uploadingImages={false} onDone={() => {}} productsError=""
      />
    </MemoryRouter>
  );
}

beforeEach(() => {
  resetDemoModeForTests();
  getDemoInfo.mockReset();
});

test('the real store has the camera and gallery buttons', async () => {
  getDemoInfo.mockResolvedValue({ demo: false });

  renderForm();

  await waitFor(() => expect(getDemoInfo).toHaveBeenCalled());
  expect(screen.getByText('צלם תמונה')).toBeInTheDocument();
  expect(screen.getByText('בחר מהגלריה')).toBeInTheDocument();
});

test('the demo has no upload control, and says why', async () => {
  getDemoInfo.mockResolvedValue({ demo: true, identities: [] });

  renderForm();

  expect(await screen.findByText(/העלאת תמונות מושבתת באתר ההדגמה/)).toBeInTheDocument();
  expect(screen.queryByText('צלם תמונה')).not.toBeInTheDocument();
  expect(screen.queryByText('בחר מהגלריה')).not.toBeInTheDocument();
  expect(document.querySelector('input[type="file"]')).toBeNull();
});
