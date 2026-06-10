import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Check, Package, Pencil, Plus, RefreshCw, ShoppingCart, Trash2, User } from 'lucide-react';
import './styles.css';

const GRAPHQL_URL = import.meta.env.VITE_GRAPHQL_URL || '/graphql';

async function graphQL(query, variables = {}) {
  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  const payload = await response.json();
  if (!response.ok || payload.errors) {
    throw new Error(payload.errors?.map((error) => error.message).join('; ') || response.statusText);
  }
  return payload.data;
}

const DASHBOARD_QUERY = `
  query Dashboard {
    users { id name email role orders { id status } }
    products { id name price stock }
    orders {
      id
      userId
      productIds
      status
      user { id name email }
      products { id name price }
    }
  }
`;

const emptyUser = { name: '', email: '' };
const emptyProduct = { name: '', price: '', stock: '' };
const emptyOrder = { userId: '', productIds: '', status: 'new' };
const orderStatuses = ['new', 'processing', 'completed', 'cancelled'];

function App() {
  const [data, setData] = useState({ users: [], products: [], orders: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setData(await graphQL(DASHBOARD_QUERY));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const productNames = useMemo(() => {
    return new Map(data.products.map((product) => [product.id, product.name]));
  }, [data.products]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Engineering lab 8</p>
          <h1>Microservices GraphQL CRUD</h1>
        </div>
        <button className="icon-button" onClick={load} title="Refresh data" aria-label="Refresh data">
          <RefreshCw size={18} />
        </button>
      </header>

      {error && <div className="alert">{error}</div>}

      <section className="summary-grid" aria-label="Summary">
        <Metric label="Users" value={data.users.length} />
        <Metric label="Products" value={data.products.length} />
        <Metric label="Orders" value={data.orders.length} />
      </section>

      <section className="crud-grid">
        <UsersPanel users={data.users} onChange={load} disabled={loading} />
        <ProductsPanel products={data.products} orders={data.orders} onChange={load} disabled={loading} />
        <OrdersPanel
          users={data.users}
          products={data.products}
          orders={data.orders}
          productNames={productNames}
          onChange={load}
          disabled={loading}
        />
      </section>
    </main>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function UsersPanel({ users, onChange, disabled }) {
  const [form, setForm] = useState(emptyUser);
  const [editingId, setEditingId] = useState('');
  const [formError, setFormError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setFormError('');
    const input = { name: form.name.trim(), email: form.email.trim(), role: 'customer' };
    if (!input.name || !input.email) {
      setFormError('Name and email are required.');
      return;
    }
    if (editingId) {
      await graphQL(`mutation UpdateUser($id: ID!, $input: UpdateUserInput!) { updateUser(id: $id, input: $input) { id } }`, {
        id: editingId,
        input
      });
    } else {
      await graphQL(`mutation CreateUser($input: CreateUserInput!) { createUser(input: $input) { id } }`, { input });
    }
    setEditingId('');
    setForm(emptyUser);
    await onChange();
  };

  return (
    <Panel title="Users" icon={<User size={18} />}>
      <form className="entity-form" onSubmit={submit}>
        <input placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        <input placeholder="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
        {formError && <div className="form-error">{formError}</div>}
        <button disabled={disabled} type="submit">
          {editingId ? <Check size={16} /> : <Plus size={16} />}
          {editingId ? 'Save user' : 'Add user'}
        </button>
      </form>
      <EntityList
        items={users}
        render={(user) => (
          <>
            <strong>{user.name}</strong>
            <span>{user.email}</span>
            <small>{user.orders.length} orders</small>
          </>
        )}
        onEdit={(user) => {
          setEditingId(user.id);
          setForm({ name: user.name, email: user.email });
        }}
        onDelete={async (user) => {
          if (user.orders.length > 0) {
            setFormError('Delete or reassign this user orders first.');
            return;
          }
          await graphQL(`mutation DeleteUser($id: ID!) { deleteUser(id: $id) }`, { id: user.id });
          await onChange();
        }}
      />
    </Panel>
  );
}

function ProductsPanel({ products, orders, onChange, disabled }) {
  const [form, setForm] = useState(emptyProduct);
  const [editingId, setEditingId] = useState('');
  const [formError, setFormError] = useState('');
  const usedProductIds = useMemo(() => {
    return new Set(orders.flatMap((order) => order.productIds));
  }, [orders]);

  const submit = async (event) => {
    event.preventDefault();
    setFormError('');
    const input = {
      name: form.name.trim(),
      price: Number(form.price),
      stock: Number(form.stock)
    };
    if (!input.name) {
      setFormError('Product name is required.');
      return;
    }
    if (form.price === '' || Number.isNaN(input.price) || input.price < 0) {
      setFormError('Price must be a non-negative number.');
      return;
    }
    if (form.stock === '' || !Number.isInteger(input.stock) || input.stock < 0) {
      setFormError('Stock must be a non-negative integer.');
      return;
    }
    if (editingId) {
      await graphQL(`mutation UpdateProduct($id: ID!, $input: UpdateProductInput!) { updateProduct(id: $id, input: $input) { id } }`, {
        id: editingId,
        input
      });
    } else {
      await graphQL(`mutation CreateProduct($input: CreateProductInput!) { createProduct(input: $input) { id } }`, { input });
    }
    setEditingId('');
    setForm(emptyProduct);
    await onChange();
  };

  return (
    <Panel title="Products" icon={<Package size={18} />}>
      <form className="entity-form" onSubmit={submit}>
        <input placeholder="Product name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        <input placeholder="Price, e.g. 199.99" type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required />
        <input placeholder="Stock quantity, e.g. 7" type="number" min="0" step="1" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} required />
        {formError && <div className="form-error">{formError}</div>}
        <button disabled={disabled} type="submit">
          {editingId ? <Check size={16} /> : <Plus size={16} />}
          {editingId ? 'Save product' : 'Add product'}
        </button>
      </form>
      <EntityList
        items={products}
        render={(product) => (
          <>
            <strong>{product.name}</strong>
            <span>${product.price.toFixed(2)}</span>
            <small>{product.stock} in stock</small>
          </>
        )}
        onEdit={(product) => {
          setEditingId(product.id);
          setForm({ name: product.name, price: String(product.price), stock: String(product.stock) });
        }}
        onDelete={async (product) => {
          if (usedProductIds.has(product.id)) {
            setFormError('Delete orders that use this product first.');
            return;
          }
          await graphQL(`mutation DeleteProduct($id: ID!) { deleteProduct(id: $id) }`, { id: product.id });
          await onChange();
        }}
      />
    </Panel>
  );
}

function OrdersPanel({ users, products, orders, productNames, onChange, disabled }) {
  const [form, setForm] = useState(emptyOrder);
  const [editingId, setEditingId] = useState('');
  const [formError, setFormError] = useState('');
  const validProductIds = useMemo(() => new Set(products.map((product) => product.id)), [products]);
  const selectedProductIds = useMemo(() => parseIds(form.productIds), [form.productIds]);
  const selectedProductNames = useMemo(() => {
    return selectedProductIds.map((id) => productNames.get(id) || id).join(', ');
  }, [productNames, selectedProductIds]);

  useEffect(() => {
    if (!form.userId && users[0]) {
      setForm((current) => ({ ...current, userId: users[0].id }));
    }
  }, [users, form.userId]);

  const submit = async (event) => {
    event.preventDefault();
    setFormError('');
    const productIds = parseIds(form.productIds);
    if (!form.userId) {
      setFormError('Select a user for the order.');
      return;
    }
    if (!productIds.length) {
      setFormError('Select at least one product.');
      return;
    }
    if (!orderStatuses.includes(form.status)) {
      setFormError('Select a valid order status.');
      return;
    }
    const unknownIds = productIds.filter((id) => !validProductIds.has(id));
    if (unknownIds.length) {
      setFormError(`Unknown product IDs: ${unknownIds.join(', ')}`);
      return;
    }
    const input = {
      userId: form.userId,
      productIds,
      status: form.status
    };
    if (editingId) {
      await graphQL(`mutation UpdateOrder($id: ID!, $input: UpdateOrderInput!) { updateOrder(id: $id, input: $input) { id } }`, {
        id: editingId,
        input
      });
    } else {
      await graphQL(`mutation CreateOrder($input: CreateOrderInput!) { createOrder(input: $input) { id } }`, { input });
    }
    setEditingId('');
    setForm({ ...emptyOrder, userId: users[0]?.id || '' });
    await onChange();
  };

  return (
    <Panel title="Orders" icon={<ShoppingCart size={18} />}>
      <form className="entity-form" onSubmit={submit}>
        <select value={form.userId} onChange={(event) => setForm({ ...form, userId: event.target.value })} required>
          {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
        </select>
        <input placeholder="Selected products" value={selectedProductNames} readOnly required />
        <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} required>
          {orderStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
        <div className="chips">
          {products.map((product) => (
            <button
              className={hasId(form.productIds, product.id) ? 'selected' : ''}
              key={product.id}
              type="button"
              onClick={() => setForm({ ...form, productIds: toggleId(form.productIds, product.id) })}
            >
              {product.name}
            </button>
          ))}
        </div>
        {formError && <div className="form-error">{formError}</div>}
        <button disabled={disabled || !users.length || !products.length} type="submit">
          {editingId ? <Check size={16} /> : <Plus size={16} />}
          {editingId ? 'Save order' : 'Add order'}
        </button>
      </form>
      <EntityList
        items={orders}
        render={(order) => (
          <>
            <strong>{order.user?.name || order.userId}</strong>
            <span>{order.status}</span>
            <small>{order.productIds.map((id) => productNames.get(id) || id).join(', ')}</small>
          </>
        )}
        onEdit={(order) => {
          setEditingId(order.id);
          setForm({ userId: order.userId, productIds: order.productIds.join(', '), status: order.status });
        }}
        onDelete={async (order) => {
          await graphQL(`mutation DeleteOrder($id: ID!) { deleteOrder(id: $id) }`, { id: order.id });
          await onChange();
        }}
      />
    </Panel>
  );
}

function Panel({ title, icon, children }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div className="panel-title">{icon}<h2>{title}</h2></div>
      </div>
      {children}
    </section>
  );
}

function EntityList({ items, render, onEdit, onDelete }) {
  return (
    <div className="entity-list">
      {items.map((item) => (
        <article className="entity-row" key={item.id}>
          <div className="entity-copy">{render(item)}</div>
          <div className="row-actions">
            <button className="icon-button" onClick={() => onEdit(item)} title="Edit" aria-label="Edit">
              <Pencil size={16} />
            </button>
            <button className="icon-button danger" onClick={() => onDelete(item)} title="Delete" aria-label="Delete">
              <Trash2 size={16} />
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function hasId(value, id) {
  return parseIds(value).includes(id);
}

function toggleId(value, id) {
  const ids = parseIds(value);
  const index = ids.indexOf(id);
  if (index >= 0) {
    ids.splice(index, 1);
  } else {
    ids.push(id);
  }
  return ids.join(', ');
}

function parseIds(value) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

createRoot(document.getElementById('root')).render(<App />);
