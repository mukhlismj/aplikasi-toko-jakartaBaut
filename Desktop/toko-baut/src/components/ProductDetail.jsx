import React, { useState, useRef, useEffect } from 'react';
import { formatRupiah, getStockTotal } from '../context/StoreContext';
import JsBarcode from 'jsbarcode';
import {
    X, Package, MapPin, TrendingUp, Calendar, Edit, ChevronLeft, ChevronRight, Eye, EyeOff,
    ShoppingCart, Copy, Barcode, Trash2
} from 'lucide-react';

export default function ProductDetail({ product, onClose, onEdit, onDuplicate, onToggleBarcodeQueue, isInBarcodeQueue, onDelete, addToCart }) {
    const [imgIdx, setImgIdx] = useState(0);
    const [showFinancial, setShowFinancial] = useState(false);
    const [toastMsg, setToastMsg] = useState('');
    const barcodeRef = useRef(null);
    if (!product) return null;

    const unit = product.unit || 'pcs';
    const totalStock = getStockTotal(product);
    const priceUnit = product.priceUnit ?? product.pricePcs ?? 0;
    const costUnit = product.costUnit || 0;
    const profitUnit = priceUnit - costUnit;
    const marginUnit = priceUnit > 0 ? ((profitUnit / priceUnit) * 100).toFixed(1) : 0;
    const images = product.images || (product.image ? [product.image] : []);
    const stockStatus = totalStock === 0 ? 'danger' : totalStock <= (product.minStockAlert || 10) ? 'warning' : 'safe';
    const qtyPerUnit = product.qtyPerUnit || product.qtyPerBulk || 0;

    const formatDate = (d) => {
        if (!d) return '-';
        return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    useEffect(() => {
        if (product.barcode && barcodeRef.current) {
            try {
                JsBarcode(barcodeRef.current, product.barcode, {
                    format: 'CODE128', width: 1.5, height: 40, displayValue: true, fontSize: 11, margin: 2,
                });
            } catch { /* invalid barcode */ }
        }
    }, [product.barcode]);

    const handleAddToCart = () => {
        if (!addToCart) return;
        const ok = addToCart(product);
        if (ok) {
            setToastMsg(`✅ ${product.name} ditambahkan ke keranjang`);
        } else {
            setToastMsg(`⚠️ Stok habis!`);
        }
        setTimeout(() => setToastMsg(''), 2500);
    };

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal" style={{ maxWidth: 580 }}>
                <div className="modal-header">
                    <h3>📦 Detail Barang</h3>
                    <button className="btn-icon" onClick={onClose}><X size={18} /></button>
                </div>
                <div className="modal-body">
                    {/* Image carousel */}
                    <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                        {images.length > 0 ? (
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                                <img src={images[imgIdx]} alt={product.name}
                                    style={{ width: 120, height: 120, borderRadius: 10, objectFit: 'cover' }} />
                                {images.length > 1 && (
                                    <>
                                        <button className="btn-icon" onClick={() => setImgIdx(i => (i - 1 + images.length) % images.length)}
                                            style={{ position: 'absolute', left: -8, top: '50%', transform: 'translateY(-50%)', background: 'var(--bg-card)', borderRadius: '50%', padding: 4 }}>
                                            <ChevronLeft size={14} />
                                        </button>
                                        <button className="btn-icon" onClick={() => setImgIdx(i => (i + 1) % images.length)}
                                            style={{ position: 'absolute', right: -8, top: '50%', transform: 'translateY(-50%)', background: 'var(--bg-card)', borderRadius: '50%', padding: 4 }}>
                                            <ChevronRight size={14} />
                                        </button>
                                        <div style={{ position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4 }}>
                                            {images.map((_, i) => (
                                                <div key={i} style={{
                                                    width: 6, height: 6, borderRadius: '50%', cursor: 'pointer',
                                                    background: i === imgIdx ? 'var(--accent-gold)' : 'var(--text-muted)'
                                                }}
                                                    onClick={() => setImgIdx(i)} />
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div style={{
                                width: 120, height: 120, borderRadius: 10, background: 'var(--bg-input)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                            }}>
                                <Package size={40} color="var(--text-muted)" />
                            </div>
                        )}
                        <div style={{ flex: 1 }}>
                            <h4 style={{ color: 'var(--text-heading)', fontSize: '1.1rem', fontWeight: 700 }}>{product.name}</h4>
                            <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                                <span className="category-badge">{product.category}</span>
                                {product.size && (
                                    <span style={{
                                        fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-blue)',
                                        background: 'var(--accent-blue-dim)', padding: '2px 10px', borderRadius: 6
                                    }}>
                                        {product.size}
                                    </span>
                                )}
                            </div>
                            {product.location && (
                                <div style={{ marginTop: 6 }}><span className="location-tag"><MapPin size={11} /> {product.location}</span></div>
                            )}
                            {product.barcode && (
                                <div style={{ marginTop: 10 }}>
                                    <svg ref={barcodeRef}></svg>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Description */}
                    {product.description && (
                        <div style={{
                            marginBottom: 16, padding: '12px 14px', background: 'var(--bg-secondary)',
                            borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5
                        }}>
                            <div style={{ fontWeight: 600, fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Deskripsi</div>
                            {product.description}
                        </div>
                    )}

                    {/* Stock & Unit Info */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                        <div className="detail-card">
                            <span className="detail-label">Satuan Jual</span>
                            <span className="detail-value" style={{ textTransform: 'uppercase' }}>{unit}</span>
                        </div>
                        <div className="detail-card">
                            <span className="detail-label">Total Stok</span>
                            <span className="detail-value">
                                <span className={`stock-badge ${stockStatus}`}>{totalStock === 0 ? 'HABIS' : `${totalStock} ${unit}`}</span>
                            </span>
                        </div>
                        {qtyPerUnit > 0 && (
                            <div className="detail-card" style={{ gridColumn: '1 / -1' }}>
                                <span className="detail-label">📦 Isi per 1 {unit}</span>
                                <span className="detail-value" style={{ color: 'var(--accent-gold)', fontSize: '1rem' }}>
                                    {qtyPerUnit} buah/item
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Harga Jual */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 16 }}>
                        <div className="detail-card">
                            <span className="detail-label">Harga Jual per {unit}</span>
                            <span className="detail-value" style={{ color: 'var(--accent-gold)', fontSize: '1.1rem' }}>{formatRupiah(priceUnit)}</span>
                        </div>
                    </div>

                    {/* Toggle Modal & Laba */}
                    <button className="btn btn-secondary btn-sm" onClick={() => setShowFinancial(!showFinancial)}
                        style={{ marginBottom: 12, width: '100%' }}>
                        {showFinancial ? <EyeOff size={14} /> : <Eye size={14} />}
                        {showFinancial ? ' Sembunyikan Modal & Laba' : ' Lihat Modal & Laba'}
                    </button>

                    {showFinancial && (
                        <div style={{
                            borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-color)', marginBottom: 16,
                            animation: 'fadeInUp 0.2s ease'
                        }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                <thead>
                                    <tr style={{ background: 'var(--bg-secondary)' }}>
                                        <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem' }}>KETERANGAN</th>
                                        <th style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem' }}>PER {unit.toUpperCase()}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>Harga Modal</td>
                                        <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--accent-orange)' }}>{costUnit > 0 ? formatRupiah(costUnit) : '-'}</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>Laba</td>
                                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: profitUnit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                                            {costUnit > 0 ? `${formatRupiah(profitUnit)} (${marginUnit}%)` : '-'}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 16, fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                        <span><Calendar size={12} style={{ marginRight: 4 }} />Dibuat: {formatDate(product.createdAt)}</span>
                        <span><Calendar size={12} style={{ marginRight: 4 }} />Diubah: {formatDate(product.updatedAt)}</span>
                    </div>

                    {/* Action Buttons — same as card */}
                    <div style={{
                        display: 'flex', gap: 8, flexWrap: 'wrap', padding: '12px 0',
                        borderTop: '1px solid var(--border-color)'
                    }}>
                        {addToCart && (
                            <button className="btn btn-sm" onClick={handleAddToCart}
                                style={{ background: 'var(--accent-gold-dim)', color: 'var(--accent-gold)', border: '1px solid rgba(240,185,11,0.3)' }}>
                                <ShoppingCart size={14} /> Tambah ke Keranjang
                            </button>
                        )}
                        <button className="btn btn-sm btn-secondary" onClick={() => { onClose(); onEdit(product); }}>
                            <Edit size={14} /> Edit
                        </button>
                        {onDuplicate && (
                            <button className="btn btn-sm btn-secondary" onClick={() => { onClose(); onDuplicate(product); }}>
                                <Copy size={14} /> Duplikat
                            </button>
                        )}
                        {onToggleBarcodeQueue && (
                            <button className="btn btn-sm btn-secondary" onClick={() => { onToggleBarcodeQueue(product); }}
                                style={{
                                    color: isInBarcodeQueue ? 'var(--accent-gold)' : 'inherit',
                                    borderColor: isInBarcodeQueue ? 'var(--accent-gold)' : 'var(--border-color)',
                                    background: isInBarcodeQueue ? 'var(--accent-gold-dim)' : 'transparent'
                                }}>
                                <Barcode size={14} />
                                {isInBarcodeQueue ? 'Hapus dari Antrean' : 'Tambah ke Antrean Barcode'}
                            </button>
                        )}
                        {onDelete && (
                            <button className="btn btn-sm" onClick={() => { onClose(); onDelete(product); }}
                                style={{ background: 'var(--accent-red-dim)', color: 'var(--accent-red)', border: '1px solid rgba(239,68,68,0.3)', marginLeft: 'auto' }}>
                                <Trash2 size={14} /> Hapus
                            </button>
                        )}
                    </div>
                </div>

                {/* Toast inside detail */}
                {toastMsg && (
                    <div style={{
                        position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
                        background: 'var(--bg-card)', color: 'var(--text-primary)',
                        padding: '10px 20px', borderRadius: 'var(--radius-sm)',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.4)', border: '1px solid var(--border-color)',
                        fontSize: '0.85rem', fontWeight: 600, zIndex: 10000,
                        animation: 'slideUp 0.3s ease', whiteSpace: 'nowrap',
                    }}>
                        {toastMsg}
                    </div>
                )}
            </div>
        </div>
    );
}
