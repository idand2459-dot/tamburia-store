/**
 * The read-only demo viewer (plan 006, Phase 3): the controls that write are not drawn for a viewer,
 * and every one of them is there for the owner. This is presentation only (the server refuses a forced
 * write with 403); it keeps the demo from showing buttons that cannot work.
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminAccessContext, ReadOnlyNote, READ_ONLY_NOTE } from '../../../pages/admin/adminAccess';
import OrderCard from '../../../pages/admin/OrderCard';
import ReviewsTab from '../../../pages/admin/ReviewsTab';
import AdminProductCard from '../../../pages/admin/AdminProductCard';
import AdminTabs from '../../../pages/admin/AdminTabs';
import ProductsTab from '../../../pages/admin/ProductsTab';

const VIEWER = { role: 'viewer', readOnly: true };
const OWNER = { role: 'owner', readOnly: false };

/** Renders `ui` as the given role. */
function renderAs(access, ui) {
  return render(<MemoryRouter><AdminAccessContext.Provider value={access}>{ui}</AdminAccessContext.Provider></MemoryRouter>);
}

const ORDER = {
  id: 7, status: 'new', delivery_method: 'pickup', customer_name: 'דנה דמו', customer_phone: '050-0000011',
  subtotal: 40, delivery_fee: 0, total: 40, created_at: '2026-10-04T08:00:00Z',
  items: [{ id: 1, name: 'צבע', price: 40, quantity: 1 }], picked_items: [],
};

const card = (props = {}) => (
  <OrderCard order={ORDER} productsById={new Map()} isOpen onToggle={() => {}}
    onStatusChange={() => {}} onTogglePicked={() => {}} onDelete={() => {}} {...props} />
);

describe('order card', () => {
  test('the owner has the next step, the status select, the delete button and ticking', () => {
    renderAs(OWNER, card());

    expect(screen.getByRole('button', { name: /מחק הזמנה/ })).toBeInTheDocument();
    expect(screen.getByLabelText('שנה סטטוס')).toBeInTheDocument();
    expect(document.querySelector('.order-next-btn')).not.toBeNull();
    expect(screen.getByRole('checkbox')).toBeEnabled();
  });

  test('the viewer sees the order and the call button but no control that changes it', () => {
    renderAs(VIEWER, card());

    expect(screen.getByText('דנה דמו')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /התקשר/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /מחק הזמנה/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('שנה סטטוס')).not.toBeInTheDocument();
    expect(document.querySelector('.order-next-btn')).toBeNull();
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });
});

describe('reviews tab', () => {
  const reviews = [
    { id: 1, reviewer_name: 'לקוח לדוגמה', rating: 5, text: 'מצוין', type: 'store', approved: false, created_at: '2026-10-01' },
    { id: 2, reviewer_name: 'לקוחה לדוגמה', rating: 4, text: 'טוב', type: 'store', approved: true, created_at: '2026-10-02' },
  ];

  test('the owner can approve and delete', () => {
    renderAs(OWNER, <ReviewsTab reviews={reviews} onApprove={() => {}} onDelete={() => {}} reviewsError="" />);

    expect(screen.getByRole('button', { name: /אשר פרסום/ })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'מחק' })).toHaveLength(2);
  });

  test('the viewer reads the reviews but cannot approve or delete', () => {
    renderAs(VIEWER, <ReviewsTab reviews={reviews} onApprove={() => {}} onDelete={() => {}} reviewsError="" />);

    expect(screen.getByText('מצוין')).toBeInTheDocument();
    expect(screen.getByText(/מפורסם/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /אשר פרסום/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'מחק' })).not.toBeInTheDocument();
  });
});

describe('product card', () => {
  const product = { id: 3, name: 'פטיש', price: 35, category: 'tools', subcategory: 'general_tools', active: true, in_stock: true, variants: [] };
  const handlers = {
    onEdit: () => {}, onDelete: () => {}, onToggleStock: () => {}, onToggleActive: () => {}, onUpdatePrice: () => {}, onUpdateSubcategory: () => {},
  };

  test('the owner can edit, hide, delete, change the price and the stock', () => {
    renderAs(OWNER, <AdminProductCard product={product} {...handlers} />);

    expect(screen.getByRole('button', { name: 'ערוך' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'מחק' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /הסתר מהחנות/ })).toBeInTheDocument();
    expect(document.querySelector('button.admin-price-btn')).not.toBeNull();
    expect(screen.getByRole('switch')).toBeEnabled();
  });

  test('the viewer sees the product, its price and its stock, and nothing that changes them', () => {
    renderAs(VIEWER, <AdminProductCard product={product} {...handlers} />);

    expect(screen.getByRole('heading', { name: 'פטיש' })).toBeInTheDocument();
    expect(document.querySelector('span.admin-price-btn')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'ערוך' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'מחק' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /הסתר מהחנות/ })).not.toBeInTheDocument();
    expect(document.querySelector('button.admin-price-btn')).toBeNull();
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  test('the products tab draws the same read-only cards', () => {
    renderAs(VIEWER, (
      <ProductsTab products={[product]} productsLoaded {...handlers} productsError="" scrollToId={null} onScrolled={() => {}} />
    ));

    expect(screen.getByRole('heading', { name: 'פטיש' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ערוך' })).not.toBeInTheDocument();
  });
});

describe('tabs', () => {
  /** Renders the navigation as the given role. */
  const renderTabs = (access) => render(
    <MemoryRouter>
      <AdminAccessContext.Provider value={access}>
        <AdminTabs activeTab="orders" onSelect={() => {}} onBack={() => {}} />
      </AdminAccessContext.Provider>
    </MemoryRouter>
  );

  test('the owner has all six tabs', () => {
    renderTabs(OWNER);

    for (const label of ['הזמנות', 'מוצרים', 'הוסף מוצר', 'סטטיסטיקות', 'ייבוא', 'ביקורות']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  test('the viewer has no tab that only writes (add product, import)', () => {
    renderTabs(VIEWER);

    expect(screen.queryByText('הוסף מוצר')).not.toBeInTheDocument();
    expect(screen.queryByText('ייבוא')).not.toBeInTheDocument();
    for (const label of ['הזמנות', 'מוצרים', 'סטטיסטיקות']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });
});

describe('read-only note', () => {
  test('is shown to the viewer only', () => {
    const viewer = renderAs(VIEWER, <ReadOnlyNote />);
    expect(screen.getByRole('note')).toHaveTextContent(READ_ONLY_NOTE);
    viewer.unmount();

    const { container } = renderAs(OWNER, <ReadOnlyNote />);
    expect(container).toBeEmptyDOMElement();
  });

  test('without a provider the admin is the owner', () => {
    const { container } = render(<ReadOnlyNote />);
    expect(container).toBeEmptyDOMElement();
  });
});
