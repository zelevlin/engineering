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

const emptyUser = { name: '', email: '', role: 'customer' };
const emptyProduct = { name: '', price: '0', stock: '0' };
const emptyOrder = { userId: '', productIds: '', status: 'new' };

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
        <ProductsPanel products={data.products} onChange={load} disabled={loading} />
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

  const submit = async (event) => {
    event.preventDefault();
    const input = { name: form.name, email: form.email, role: form.role };
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
        <input placeholder="Role" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} required />
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
            <small>{user.role} · {user.orders.length} orders</small>
          </>
        )}
        onEdit={(user) => {
          setEditingId(user.id);
          setForm({ name: user.name, email: user.email, role: user.role });
        }}
        onDelete={async (user) => {
          await graphQL(`mutation DeleteUser($id: ID!) { deleteUser(id: $id) }`, { id: user.id });
          await onChange();
        }}
      />
    </Panel>
  );
}

function ProductsPanel({ products, onChange, disabled }) {
  const [form, setForm] = useState(emptyProduct);
  const [editingId, setEditingId] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    const input = { name: form.name, price: Number(form.price), stock: Number(form.stock) };
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
        <input placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        <input placeholder="Price" type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required />
        <input placeholder="Stock" type="number" min="0" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} required />
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

  useEffect(() => {
    if (!form.userId && users[0]) {
      setForm((current) => ({ ...current, userId: users[0].id }));
    }
  }, [users, form.userId]);

  const submit = async (event) => {
    event.preventDefault();
    const input = {
      userId: form.userId,
      productIds: form.productIds.split(',').map((id) => id.trim()).filter(Boolean),
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
        <input placeholder="Product IDs, comma-separated" value={form.productIds} onChange={(event) => setForm({ ...form, productIds: event.target.value })} required />
        <input placeholder="Status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} required />
        <div className="chips">
          {products.map((product) => <button key={product.id} type="button" onClick={() => setForm({ ...form, productIds: appendId(form.productIds, product.id) })}>{product.id}</button>)}
        </div>
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

function appendId(value, id) {
  const ids = value.split(',').map((item) => item.trim()).filter(Boolean);
  if (!ids.includes(id)) ids.push(id);
  return ids.join(', ');
}

createRoot(document.getElementById('root')).render(<App />);
