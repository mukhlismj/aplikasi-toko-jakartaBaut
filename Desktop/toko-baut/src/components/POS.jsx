import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { getStockTotal, formatRupiah } from '../context/StoreContext';
import Invoice from './Invoice';
import ProductDetail from './ProductDetail';
import ProductForm from './ProductForm';
import { Search, ShoppingCart, X, CreditCard, Package, Barcode, Minus } from 'lucide-react';

// Number formatting helpers
const formatNumberInput = (val) => {
    if (!val && val !== 0) return '';
    const num = String(val).replace(/\D/g, '');
    if (!num) return '';
    return Number(num).toLocaleString('id-ID');
};
const parseNumberInput = (str) => {
    if (!str) return 0;
    return Number(String(str).replace(/\./g, '').replace(/,/g, '')) || 0;
};

export default function POS({ carts, setCarts, activeCartId, setActiveCartId, addToCart }) {
    const { products, addTransaction, getNextInvoiceNo, findByBarcode } = useStore();
    const [search, setSearch] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [showPayment, setShowPayment] = useState(false);
    const [paymentAmountStr, setPaymentAmountStr] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('CASH');
    const [priceAdjustment, setPriceAdjustment] = useState('');
    const [completedTransaction, setCompletedTransaction] = useState(null);
    const [detailProduct, setDetailProduct] = useState(null);
    const [editProduct, setEditProduct] = useState(null);
    const [confirmDeleteCart, setConfirmDeleteCart] = useState(null);
    const searchRef = useRef(null);

    const uniqueCategories = useMemo(() =>
        [...new Set(products.map(p => p.category).filter(Boolean))].sort()
        , [products]);
    const barcodeBuffer = useRef('');
    const barcodeTimer = useRef(null);

    // Barcode scanner detection
    const handleSearchChange = (e) => {
        const val = e.target.value;
        setSearch(val);
        clearTimeout(barcodeTimer.current);
        barcodeTimer.current = setTimeout(() => {
            if (val.length >= 8) {
                const found = findByBarcode(val.trim());
                if (found) {
                    addToCart(found);
                    setSearch('');
                }
            }
        }, 200);
    };

    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const q = search.toLowerCase();
            const matchSearch = !search ||
                p.name.toLowerCase().includes(q) ||
                p.category.toLowerCase().includes(q) ||
                (p.size && p.size.toLowerCase().includes(q)) ||
                (p.barcode && p.barcode.includes(search));
            const matchCategory = !filterCategory || p.category === filterCategory;
            return matchSearch && matchCategory;
        });
    }, [products, search, filterCategory]);

    // Get the active cart's data
    const activeCart = carts.find(c => c.id === activeCartId) || carts[0];
    const cart = activeCart.items;
    const customerName = activeCart.customerName;

    const setCustomerName = (name) => {
        setCarts(prev => prev.map(c => c.id === activeCartId ? { ...c, customerName: name } : c));
    };

    const updateCartItem = (productId, field, value) => {
        setCarts(prevCarts => prevCarts.map(c => {
            if (c.id !== activeCartId) return c;
            return {
                ...c,
                items: c.items.map(item => {
                    if (item.productId !== productId) return item;
                    const updated = { ...item, [field]: value };
                    if (field === 'unit') {
                        updated.pricePerUnit = value === item.bulkUnit ? item.priceBulk : item.priceUnit;
                    }
                    return updated;
                })
            };
        }));
    };

    const removeFromCart = (productId) => {
        setCarts(prevCarts => prevCarts.map(c => {
            if (c.id !== activeCartId) return c;
            return { ...c, items: c.items.filter(item => item.productId !== productId) };
        }));
    };

    const clearCart = () => {
        setCarts(prevCarts => prevCarts.map(c => c.id === activeCartId ? { ...c, items: [], customerName: '' } : c));
    };

    // Cart Navigation functions
    const createNewCart = () => {
        if (carts.length >= 10) return; // limit to 10 carts
        const newId = Date.now();
        const newCartNumber = carts.length + 1;
        setCarts(prev => [...prev, { id: newId, name: `Pelanggan ${newCartNumber}`, items: [], customerName: '' }]);
        setActiveCartId(newId);
    };

    const handleDeleteCartClick = (cartId) => {
        const cartToDelete = carts.find(c => c.id === cartId);
        if (cartToDelete && cartToDelete.items.length > 0) {
            setConfirmDeleteCart(cartToDelete);
        } else {
            deleteCart(cartId);
        }
    };

    const confirmCartDeletion = () => {
        if (confirmDeleteCart) {
            deleteCart(confirmDeleteCart.id);
            setConfirmDeleteCart(null);
        }
    };

    const deleteCart = (cartId) => {
        if (carts.length <= 1) {
            clearCart(); // Just clear it if it's the last one
            return;
        }
        setCarts(prev => {
            const filtered = prev.filter(c => c.id !== cartId);
            // If we deleted the active cart, switch to the first available one
            if (cartId === activeCartId) {
                setActiveCartId(filtered[0].id);
            }
            return filtered;
        });
    };

    const calcItemSubtotal = (item) => {
        const base = item.pricePerUnit * item.quantity;
        return base - (base * (item.discountPercent / 100));
    };

    const totalBeforeDiscount = cart.reduce((sum, item) => sum + (item.pricePerUnit * item.quantity), 0);
    const totalDiscount = cart.reduce((sum, item) => {
        const base = item.pricePerUnit * item.quantity;
        return sum + (base * (item.discountPercent / 100));
    }, 0);
    const adjustmentNum = parseNumberInput(priceAdjustment);
    const grandTotal = Math.max(0, totalBeforeDiscount - totalDiscount - adjustmentNum);
    const payAmountNum = parseNumberInput(paymentAmountStr);
    const changeAmount = payAmountNum - grandTotal;

    const handlePay = () => {
        if (paymentMethod === 'CASH' && payAmountNum < grandTotal) return;
        const finalPayAmount = paymentMethod === 'CASH' ? payAmountNum : grandTotal;
        const finalChange = paymentMethod === 'CASH' ? changeAmount : 0;
        const invoiceNo = getNextInvoiceNo();

        const transaction = {
            invoiceNo,
            customerName: customerName.trim() || 'Umum',
            items: cart.map(item => ({
                productId: item.productId, name: item.name, category: item.category,
                unit: item.unit, quantity: item.quantity, pricePerUnit: item.pricePerUnit,
                discountPercent: item.discountPercent, subtotal: calcItemSubtotal(item),
            })),
            totalBeforeDiscount, totalDiscount,
            priceAdjustment: adjustmentNum,
            grandTotal,
            paymentAmount: finalPayAmount, changeAmount: finalChange, paymentMethod,
        };

        addTransaction(transaction);
        setCompletedTransaction({ ...transaction, date: new Date().toISOString() });
        setShowPayment(false);
        setPaymentAmountStr('');
        setPriceAdjustment('');

        // Remove this cart after successful payment, or clear if it's the only one
        deleteCart(activeCartId);
    };

    // Click cart item name → show product detail
    const handleCartItemClick = (productId) => {
        const product = products.find(p => p.id === productId);
        if (product) setDetailProduct(product);
    };

    if (completedTransaction) {
        return <Invoice transaction={completedTransaction} onClose={() => setCompletedTransaction(null)} />;
    }

    return (
        <div className="pos-container">
            <div className="pos-catalog">
                <div className="catalog-header" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <div className="search-box" style={{ flex: 1, minWidth: 180 }}>
                        <Search size={18} />
                        <input type="text" placeholder="Cari / scan barcode..."
                            ref={searchRef} value={search} onChange={handleSearchChange}
                            autoFocus />
                        <Barcode size={16} style={{ opacity: 0.3, flexShrink: 0 }} />
                    </div>
                    <select className="filter-select" value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        style={{ minWidth: 140, maxWidth: 200, fontSize: '0.82rem' }}>
                        <option value="">Semua Kategori</option>
                        {uniqueCategories.map((cat, i) => <option key={i} value={cat}>{cat}</option>)}
                    </select>
                </div>
                <div className="catalog-grid">
                    {filteredProducts.length === 0 ? (
                        <div className="empty-state" style={{ gridColumn: '1/-1' }}>
                            <Package size={40} /><p>Tidak ada barang ditemukan</p>
                        </div>
                    ) : (
                        filteredProducts.map(product => {
                            const totalStock = getStockTotal(product);
                            const isOutOfStock = totalStock <= 0;
                            const unit = product.unit || 'pcs';
                            const bulk = product.bulkUnit || '';
                            return (
                                <div key={product.id}
                                    className={`pos-product-item ${isOutOfStock ? 'out-of-stock' : ''}`}
                                    onClick={() => addToCart(product)}>
                                    <div className="pos-item-name">{product.name}</div>
                                    <div className="pos-item-cat">{product.category} {product.size && `• ${product.size}`}</div>
                                    <div className="pos-item-price">
                                        {formatRupiah(product.priceUnit ?? product.pricePcs ?? 0)}/{unit}
                                    </div>
                                    <div className="pos-item-stock">
                                        Stok: {bulk
                                            ? `${product.stockBulk ?? 0}${bulk}, ${product.stockUnit ?? 0}${unit}`
                                            : `${product.stockUnit ?? 0} ${unit}`}
                                        {isOutOfStock && ' (HABIS)'}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            <div className="pos-cart" style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Cart Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', padding: '8px 8px 0', gap: 6, alignItems: 'flex-end' }}>

                    <div style={{ display: 'flex', overflowX: 'auto', gap: 4, flex: 1, paddingBottom: 2 }} className="custom-scrollbar-hide">
                        {carts.map((c, i) => (
                            <div key={c.id}
                                style={{
                                    padding: '8px 12px',
                                    background: c.id === activeCartId ? 'var(--bg-card)' : 'transparent',
                                    border: '1px solid var(--border-color)',
                                    borderBottom: c.id === activeCartId ? '1px solid var(--bg-card)' : '1px solid var(--border-color)',
                                    marginBottom: '-1px',
                                    borderRadius: '6px 6px 0 0',
                                    cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    fontWeight: c.id === activeCartId ? 600 : 400,
                                    color: c.id === activeCartId ? 'var(--text-heading)' : 'var(--text-muted)',
                                    minWidth: 'max-content',
                                    zIndex: c.id === activeCartId ? 2 : 1
                                }}
                                onClick={() => setActiveCartId(c.id)}
                            >
                                <span>{c.customerName || `Pelanggan ${i + 1}`}</span>
                                {c.items.length > 0 && (
                                    <span style={{ background: 'var(--accent-gold-dim)', color: 'var(--accent-gold)', fontSize: '0.7rem', padding: '2px 6px', borderRadius: 10, fontWeight: 700 }}>
                                        {c.items.length}
                                    </span>
                                )}
                                <button className="btn-icon" onClick={(e) => { e.stopPropagation(); handleDeleteCartClick(c.id); }} style={{ padding: 2 }}>
                                    <X size={12} color="var(--text-muted)" />
                                </button>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 6 }}>
                        {carts.length > 3 && (
                            <select
                                value={activeCartId}
                                onChange={(e) => setActiveCartId(Number(e.target.value))}
                                style={{ padding: '6px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.8rem', background: 'var(--bg-card)', maxWidth: 120 }}
                                title="Pindah ke antrean lain"
                            >
                                {carts.map((c, i) => (
                                    <option key={c.id} value={c.id}>
                                        {c.customerName || `Pel. ${i + 1}`} ({c.items.length})
                                    </option>
                                ))}
                            </select>
                        )}
                        {carts.length < 10 && (
                            <button className="btn btn-secondary btn-sm" onClick={createNewCart} style={{ padding: '6px 12px', background: 'var(--bg-card)' }} title="Pesan Baru (Antrean)">
                                <span style={{ fontSize: '1rem', lineHeight: 1 }}>+</span> Baru
                            </button>
                        )}
                    </div>
                </div>

                <div className="cart-header" style={{ paddingTop: 16 }}>
                    <h3><ShoppingCart size={20} /> Keranjang
                        {cart.length > 0 && <span className="cart-count">{cart.length}</span>}
                    </h3>
                    {cart.length > 0 && (
                        <button className="btn btn-secondary btn-sm" onClick={clearCart}><X size={14} /> Kosongkan</button>
                    )}
                </div>
                <div className="cart-customer">
                    <input type="text" placeholder="Nama pelanggan (opsional)"
                        value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                </div>
                <div className="cart-items" style={{ flex: 1 }}>
                    {cart.length === 0 ? (
                        <div className="empty-state" style={{ padding: '32px 0' }}>
                            <ShoppingCart size={32} style={{ opacity: 0.2 }} />
                            <p style={{ fontSize: '0.82rem', marginTop: 8 }}>Klik barang untuk menambahkan</p>
                        </div>
                    ) : (
                        cart.map(item => (
                            <div key={item.productId} className="cart-item">
                                <div className="cart-item-header">
                                    <div className="cart-item-name"
                                        style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                                        onClick={() => handleCartItemClick(item.productId)}
                                        title="Klik untuk lihat detail barang">
                                        {item.name}
                                    </div>
                                    <button className="cart-item-remove" onClick={() => removeFromCart(item.productId)}><X size={16} /></button>
                                </div>
                                <div className="cart-item-controls">
                                    <select value={item.unit} onChange={(e) => updateCartItem(item.productId, 'unit', e.target.value)}>
                                        <option value={item.primaryUnit}>{item.primaryUnit.toUpperCase()}</option>
                                        {item.bulkUnit && item.priceBulk > 0 && (
                                            <option value={item.bulkUnit}>{item.bulkUnit.toUpperCase()}</option>
                                        )}
                                    </select>
                                    <input type="number" className="qty-input" value={item.quantity}
                                        onChange={(e) => updateCartItem(item.productId, 'quantity', Math.max(0.1, Number(e.target.value) || 1))}
                                        min={['kg', 'gram', 'meter', 'cm', 'liter'].includes(item.unit) ? '0.1' : '1'}
                                        step={['kg', 'gram', 'meter', 'cm', 'liter'].includes(item.unit) ? '0.1' : '1'} />
                                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>× {formatRupiah(item.pricePerUnit)}</span>
                                    <input type="number" className="discount-input" placeholder="Disc %"
                                        value={item.discountPercent || ''}
                                        onChange={(e) => updateCartItem(item.productId, 'discountPercent', Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                                        min="0" max="100" />
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>%</span>
                                </div>
                                <div className="cart-item-subtotal">{formatRupiah(calcItemSubtotal(item))}</div>
                            </div>
                        ))
                    )}
                </div>
                {cart.length > 0 && (
                    <div className="cart-summary">
                        <div className="summary-row"><span className="label">Subtotal</span><span className="value">{formatRupiah(totalBeforeDiscount)}</span></div>
                        {totalDiscount > 0 && (
                            <div className="summary-row"><span className="label">Diskon</span><span className="value" style={{ color: 'var(--accent-red)' }}>-{formatRupiah(totalDiscount)}</span></div>
                        )}
                        {adjustmentNum > 0 && (
                            <div className="summary-row"><span className="label">Potongan</span><span className="value" style={{ color: 'var(--accent-red)' }}>-{formatRupiah(adjustmentNum)}</span></div>
                        )}
                        <div className="summary-row total"><span className="label">Total</span><span className="value">{formatRupiah(grandTotal)}</span></div>
                        <button className="cart-pay-btn" onClick={() => setShowPayment(true)} disabled={cart.length === 0}>
                            <CreditCard size={20} style={{ marginRight: 8 }} /> Bayar {formatRupiah(grandTotal)}
                        </button>
                    </div>
                )}
            </div>

            {/* Payment Modal */}
            {showPayment && (
                <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowPayment(false)}>
                    <div className="modal" style={{ maxWidth: 450 }}>
                        <div className="modal-header"><h3>💰 Pembayaran</h3><button className="btn-icon" onClick={() => setShowPayment(false)}><X size={18} /></button></div>
                        <div className="modal-body">
                            <div className="payment-info">
                                <div className="payment-row"><span>Subtotal</span><span>{formatRupiah(totalBeforeDiscount)}</span></div>
                                {totalDiscount > 0 && <div className="payment-row"><span>Diskon</span><span style={{ color: 'var(--accent-red)' }}>-{formatRupiah(totalDiscount)}</span></div>}
                                {adjustmentNum > 0 && <div className="payment-row"><span>Potongan</span><span style={{ color: 'var(--accent-red)' }}>-{formatRupiah(adjustmentNum)}</span></div>}
                                <div className="payment-row grand-total"><span>Total Bayar</span><span>{formatRupiah(grandTotal)}</span></div>
                            </div>

                            {/* Price Adjustment */}
                            <div className="form-group">
                                <label><Minus size={14} style={{ marginRight: 4 }} />Potongan Harga (Rp)</label>
                                <input className="form-control" type="text" inputMode="numeric"
                                    value={priceAdjustment ? formatNumberInput(priceAdjustment) : ''}
                                    onChange={(e) => setPriceAdjustment(e.target.value.replace(/\./g, ''))}
                                    placeholder="Contoh: 2.000"
                                    style={{ fontSize: '1rem', fontWeight: 600 }} />
                                {adjustmentNum > 0 && (
                                    <div style={{ fontSize: '0.75rem', color: 'var(--accent-orange)', marginTop: 4 }}>
                                        Total setelah potongan: {formatRupiah(grandTotal)}
                                    </div>
                                )}
                            </div>

                            <div className="form-group">
                                <label>Metode Pembayaran</label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {['CASH', 'TRANSFER', 'QRIS'].map(m => (
                                        <button key={m} type="button"
                                            className={`btn ${paymentMethod === m ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                                            onClick={() => setPaymentMethod(m)} style={{ flex: 1, justifyContent: 'center' }}>{m}</button>
                                    ))}
                                </div>
                            </div>
                            {paymentMethod === 'CASH' && (
                                <>
                                    <div className="form-group">
                                        <label>Jumlah Uang Diterima (Rp)</label>
                                        <input className="form-control" type="text" inputMode="numeric"
                                            value={paymentAmountStr ? formatNumberInput(paymentAmountStr) : ''}
                                            onChange={(e) => setPaymentAmountStr(e.target.value.replace(/\./g, ''))}
                                            placeholder="Masukkan jumlah uang..."
                                            autoFocus
                                            style={{ fontSize: '1.2rem', fontWeight: 700, textAlign: 'center' }} />
                                    </div>
                                    {payAmountNum > 0 && (
                                        <div className={`change-display ${payAmountNum < grandTotal ? 'insufficient' : ''}`}>
                                            <div className="change-label">{payAmountNum < grandTotal ? 'Uang Kurang' : 'Kembalian'}</div>
                                            <div className="change-amount">{payAmountNum < grandTotal ? formatRupiah(grandTotal - payAmountNum) : formatRupiah(changeAmount)}</div>
                                        </div>
                                    )}
                                </>
                            )}
                            {paymentMethod !== 'CASH' && (
                                <div style={{ background: 'var(--accent-green-dim)', padding: '16px', borderRadius: 'var(--radius-sm)', textAlign: 'center', color: 'var(--accent-green)', fontSize: '0.9rem', fontWeight: 600 }}>
                                    Total: {formatRupiah(grandTotal)} via {paymentMethod}
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowPayment(false)}>Batal</button>
                            <button className="btn btn-success" onClick={handlePay}
                                disabled={paymentMethod === 'CASH' && payAmountNum < grandTotal}>✅ Konfirmasi Bayar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Product Detail from cart click */}
            {detailProduct && (
                <ProductDetail product={detailProduct} onClose={() => setDetailProduct(null)}
                    onEdit={(p) => { setDetailProduct(null); setEditProduct(p); }} />
            )}
            {editProduct && (
                <ProductForm product={editProduct} onClose={() => setEditProduct(null)} />
            )}
            {/* Delete Cart Confirm Modal */}
            {confirmDeleteCart && (
                <div className="modal-overlay" onClick={() => setConfirmDeleteCart(null)}>
                    <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>🗑️ Tutup Antrean Kasir</h3>
                            <button className="btn-icon" onClick={() => setConfirmDeleteCart(null)}><X size={18} /></button>
                        </div>
                        <div className="modal-body" style={{ textAlign: 'center' }}>
                            <div style={{
                                width: 60, height: 60, borderRadius: '50%', background: 'var(--accent-orange-dim)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
                            }}>
                                <X size={28} color="var(--accent-orange)" />
                            </div>
                            <p style={{ color: 'var(--text-heading)', fontWeight: 600, fontSize: '1rem', marginBottom: 8 }}>
                                Yakin hapus tab "{confirmDeleteCart.customerName || 'Pelanggan'}"?
                            </p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                Terdapat <strong>{confirmDeleteCart.items.length} barang</strong> di keranjang ini yang belum dibayar dan akan hilang.
                            </p>
                        </div>
                        <div className="modal-footer" style={{ justifyContent: 'center', gap: 12 }}>
                            <button className="btn btn-secondary" onClick={() => setConfirmDeleteCart(null)}>Batal</button>
                            <button className="btn" onClick={confirmCartDeletion}
                                style={{ background: 'var(--accent-orange)', color: '#fff' }}>
                                <X size={16} /> Ya, Hapus Tab
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
