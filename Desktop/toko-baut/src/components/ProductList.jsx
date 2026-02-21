import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { getStockTotal, formatRupiah } from '../context/StoreContext';
import ProductForm from './ProductForm';
import ProductDetail from './ProductDetail';
import JsBarcode from 'jsbarcode';
import * as XLSX from 'xlsx';
import {
    Search, Plus, Edit, Trash2, Package, MapPin, Eye, EyeOff, Copy, Barcode, X,
    ChevronLeft, ChevronRight, Upload, FileSpreadsheet, Printer, ClipboardCopy, ShoppingCart
} from 'lucide-react';

export default function ProductList({ addToCart }) {
    const { products, deleteProduct, storeSettings, addBulkProducts } = useStore();
    const [toastMessage, setToastMessage] = useState('');
    const [search, setSearch] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterUnit, setFilterUnit] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editProduct, setEditProduct] = useState(null);
    const [duplicateProduct, setDuplicateProduct] = useState(null);
    const [detailProduct, setDetailProduct] = useState(null);
    const [showCost, setShowCost] = useState(false);
    const [enlargedImage, setEnlargedImage] = useState(null);
    const [barcodeQueue, setBarcodeQueue] = useState([]);
    const [showBarcodeModal, setShowBarcodeModal] = useState(false);
    const [barcodeSettings, setBarcodeSettings] = useState({
        qty: 1,
        labelWidth: 50,  // mm
        labelHeight: 30, // mm
        gapX: 2,         // mm horizontal gap
        gapY: 2,         // mm vertical gap
        columns: 3,      // labels per row
        showStoreName: true,
        showProductName: true,
        showSize: true,
        showPrice: true,
        showBarcode: true,
        showQtyPerUnit: true,
    });
    const [showBulkUpload, setShowBulkUpload] = useState(false);
    const [bulkPreview, setBulkPreview] = useState(null);
    const [bulkError, setBulkError] = useState('');
    const [showExport, setShowExport] = useState(false);
    const [exportCategory, setExportCategory] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const barcodeRef = useRef(null);
    const fileInputRef = useRef(null);

    const uniqueCategories = useMemo(() =>
        [...new Set(products.map(p => p.category).filter(Boolean))].sort()
        , [products]);

    const uniqueUnits = useMemo(() =>
        [...new Set(products.map(p => p.unit || 'pcs').filter(Boolean))].sort()
        , [products]);

    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const q = search.toLowerCase();
            const matchSearch = !search ||
                p.name.toLowerCase().includes(q) ||
                p.category.toLowerCase().includes(q) ||
                (p.size && p.size.toLowerCase().includes(q)) ||
                (p.barcode && p.barcode.includes(search));
            const matchCategory = !filterCategory || p.category === filterCategory;
            const matchUnit = !filterUnit || (p.unit || 'pcs') === filterUnit;
            return matchSearch && matchCategory && matchUnit;
        });
    }, [products, search, filterCategory, filterUnit]);

    const handleEdit = (p) => { setEditProduct(p); setDuplicateProduct(null); setShowForm(true); };
    const handleDuplicate = (p) => { setEditProduct(null); setDuplicateProduct(p); setShowForm(true); };
    const handleDelete = (p) => { setDeleteConfirm(p); };
    const confirmDelete = () => {
        if (deleteConfirm) {
            deleteProduct(deleteConfirm.id);
            setDeleteConfirm(null);
        }
    };
    const handleCloseForm = () => { setShowForm(false); setEditProduct(null); setDuplicateProduct(null); };

    useEffect(() => {
        if (showBarcodeModal && barcodeQueue.length > 0 && barcodeRef.current) {
            // Render the first item's barcode in the preview
            try {
                JsBarcode(barcodeRef.current, barcodeQueue[0].product.barcode || '000000000000', {
                    format: 'CODE128', width: 1.5, height: 50, displayValue: true, fontSize: 11, margin: 4,
                });
            } catch { }
        }
    }, [showBarcodeModal, barcodeQueue]);

    const handleToggleBarcodeQueue = (product) => {
        setBarcodeQueue(prev => {
            const exists = prev.find(item => item.product.id === product.id);
            if (exists) {
                return prev.filter(item => item.product.id !== product.id);
            } else {
                return [...prev, { product, qty: 1 }];
            }
        });
    };

    const handleUpdateQueueQty = (productId, newQty) => {
        setBarcodeQueue(prev => prev.map(item =>
            item.product.id === productId ? { ...item, qty: Math.max(1, newQty) } : item
        ));
    };

    const handleRemoveFromQueue = (productId) => {
        setBarcodeQueue(prev => prev.filter(item => item.product.id !== productId));
        if (barcodeQueue.length === 1) {
            setShowBarcodeModal(false); // Close if empty
        }
    };

    const executePrint = () => {
        if (barcodeQueue.length === 0) return;
        const s = barcodeSettings;
        const storeName = storeSettings?.storeName || 'Toko Jakarta Baut';

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        let labelsHTML = '';
        let barcodeScripts = '';
        let svgIndex = 0;

        barcodeQueue.forEach((item) => {
            const p = item.product;
            const productName = p.name || '';
            const productSize = p.size || '';
            const priceText = formatRupiah(p.priceUnit ?? p.pricePcs ?? 0) + ' / ' + (p.unit || 'pcs');
            const qtyPerUnitText = (p.qtyPerUnit || p.qtyPerBulk || 0) > 0 ? `Isi: ${p.qtyPerUnit || p.qtyPerBulk} per 1 ${p.unit || 'pcs'}` : '';
            const barcodeValue = p.barcode || '000000000000';

            for (let i = 0; i < item.qty; i++) {
                labelsHTML += `
                    <div class="label" style="width:${s.labelWidth}mm;height:${s.labelHeight}mm;">
                        ${s.showStoreName ? `<div class="store">${storeName}</div>` : ''}
                        ${s.showProductName ? `<div class="name">${productName}</div>` : ''}
                        ${s.showSize && productSize ? `<div class="size">${productSize}</div>` : ''}
                        ${s.showQtyPerUnit && qtyPerUnitText ? `<div class="qty-per-unit">${qtyPerUnitText}</div>` : ''}
                        ${s.showPrice ? `<div class="price">${priceText}</div>` : ''}
                        ${s.showBarcode ? `<svg id="bc-${svgIndex}"></svg>` : ''}
                    </div>
                `;

                if (s.showBarcode) {
                    barcodeScripts += `
                        try {
                            JsBarcode('#bc-${svgIndex}', '${barcodeValue}', {
                                format: 'CODE128',
                                width: 1.2,
                                height: Math.min(${s.labelHeight} * 0.35, 30),
                                displayValue: true,
                                fontSize: 9,
                                margin: 1,
                            });
                        } catch(e) {}
                    `;
                }
                svgIndex++;
            }
        });

        printWindow.document.write(`<!DOCTYPE html><html><head><title>Cetak Barcode</title>
            <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: Arial, sans-serif; }
                .grid {
                    display: flex; flex-wrap: wrap;
                    gap: ${s.gapY}mm ${s.gapX}mm;
                    padding: 2mm;
                }
                .label {
                    border: 1px dashed #888;
                    display: flex; flex-direction: column;
                    align-items: center; justify-content: center;
                    padding: 1mm; overflow: hidden;
                    page-break-inside: avoid;
                }
                .store { font-size: 7pt; font-weight: bold; text-align: center; }
                .name { font-size: 8pt; font-weight: bold; text-align: center; margin-top: 0.5mm; }
                .size { font-size: 7pt; color: #555; text-align: center; }
                .qty-per-unit { font-size: 7pt; color: #333; text-align: center; margin-top: 0.5mm; font-style: italic; }
                .price { font-size: 8pt; font-weight: bold; text-align: center; margin-top: 0.5mm; }
                svg { display: block; margin: 0 auto; max-width: 100%; }
                @media print {
                    .label { border: none; }
                    @page { margin: 0; }
                }
            </style>
        </head><body>
            <div class="grid">${labelsHTML}</div>
            <script>
                ${barcodeScripts}
                setTimeout(() => { window.print(); window.close(); }, 500);
            <\/script>
        </body></html>`);
        printWindow.document.close();

        // Cukup tutup modal, atau bisa juga setBarcodeQueue([]) untuk mengosongkan antrean
        setShowBarcodeModal(false);
        setBarcodeQueue([]);
    };

    // === BULK UPLOAD ===
    const TEMPLATE_HEADERS = ['Nama Barang', 'Kategori', 'Ukuran', 'Deskripsi', 'Satuan', 'Harga Jual', 'Harga Modal', 'Stok', 'Lokasi', 'Barcode'];
    const [headerCopied, setHeaderCopied] = useState(false);

    const copyHeaders = () => {
        navigator.clipboard.writeText(TEMPLATE_HEADERS.join('\t')).then(() => {
            setHeaderCopied(true);
            setTimeout(() => setHeaderCopied(false), 2000);
        });
    };

    // === EXPORT DATA ===
    const [exportCopied, setExportCopied] = useState(false);

    const getExportData = () => {
        return exportCategory
            ? products.filter(p => p.category === exportCategory)
            : products;
    };

    const copyExportData = () => {
        const data = getExportData();
        if (!data.length) return;
        const headers = ['No', 'Nama Barang', 'Kategori', 'Ukuran', 'Satuan', 'Harga Jual', 'Harga Modal', 'Stok', 'Lokasi', 'Barcode'];
        const rows = data.map((p, i) => [
            i + 1, p.name || '', p.category || '', p.size || '',
            p.unit || 'pcs', p.priceUnit ?? p.pricePcs ?? 0, p.costUnit || 0,
            getStockTotal(p), p.location || '', p.barcode || ''
        ].join('\t'));
        const text = [headers.join('\t'), ...rows].join('\n');
        navigator.clipboard.writeText(text).then(() => {
            setExportCopied(true);
            setTimeout(() => setExportCopied(false), 2500);
        });
    };

    const printExportData = () => {
        const data = getExportData();
        if (!data.length) return;
        const categoryLabel = exportCategory || 'Semua Kategori';
        const dateStr = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
        const storeName = storeSettings?.storeName || 'Toko Jakarta Baut';

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html><head><title>Data Barang - ${storeName}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: Arial, sans-serif; padding: 16px; font-size: 11px; color: #111; }
                .header { text-align: center; margin-bottom: 12px; border-bottom: 2px solid #333; padding-bottom: 8px; }
                .header h1 { font-size: 16px; margin-bottom: 2px; }
                .header p { font-size: 11px; color: #555; }
                table { width: 100%; border-collapse: collapse; margin-top: 8px; }
                th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
                th { background: #f0f0f0; font-weight: 700; font-size: 10px; text-transform: uppercase; }
                td { font-size: 10px; }
                .right { text-align: right; }
                .footer { margin-top: 10px; font-size: 9px; color: #888; text-align: center; }
                tr:nth-child(even) { background: #fafafa; }
                @media print { body { padding: 0; } }
            </style></head><body>
            <div class="header">
                <h1>${storeName}</h1>
                <p>Data Barang — ${categoryLabel} — ${dateStr}</p>
            </div>
            <table>
                <thead><tr>
                    <th>No</th><th>Nama Barang</th><th>Kategori</th><th>Ukuran</th>
                    <th>Satuan</th><th class="right">Harga Jual</th><th class="right">Harga Modal</th>
                    <th class="right">Stok</th><th>Lokasi</th><th>Barcode</th>
                </tr></thead><tbody>
                ${data.map((p, i) => {
            const totalStock = getStockTotal(p);
            const price = p.priceUnit ?? p.pricePcs ?? 0;
            const cost = p.costUnit || 0;
            return `<tr>
                        <td>${i + 1}</td>
                        <td>${p.name || ''}</td>
                        <td>${p.category || ''}</td>
                        <td>${p.size || ''}</td>
                        <td>${p.unit || 'pcs'}</td>
                        <td class="right">${price.toLocaleString('id-ID')}</td>
                        <td class="right">${cost.toLocaleString('id-ID')}</td>
                        <td class="right">${totalStock}</td>
                        <td>${p.location || ''}</td>
                        <td>${p.barcode || ''}</td>
                    </tr>`;
        }).join('')}
                </tbody>
            </table>
            <div class="footer">Dicetak pada ${dateStr} — Total: ${data.length} barang</div>
            </body></html>
        `);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 300);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setBulkError('');
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = new Uint8Array(ev.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(sheet);

                if (!json.length) { setBulkError('File kosong atau format tidak sesuai.'); return; }

                const mapped = json.map((row, i) => {
                    const name = row['Nama Barang'] || row['nama_barang'] || row['name'] || '';
                    const category = row['Kategori'] || row['kategori'] || row['category'] || 'Lainnya';
                    if (!name) return null;
                    return {
                        name: name.trim(),
                        category: category.trim(),
                        size: (row['Ukuran'] || row['ukuran'] || row['size'] || '').toString().trim(),
                        description: (row['Deskripsi'] || row['deskripsi'] || row['description'] || '').toString().trim(),
                        unit: (row['Satuan'] || row['satuan'] || row['unit'] || 'pcs').toString().trim().toLowerCase(),
                        priceUnit: Number(row['Harga Jual'] || row['harga_jual'] || row['price'] || 0),
                        costUnit: Number(row['Harga Modal'] || row['harga_modal'] || row['cost'] || 0),
                        stockUnit: Number(row['Stok'] || row['stok'] || row['stock'] || 0),
                        location: (row['Lokasi'] || row['lokasi'] || row['location'] || '').toString().trim(),
                        barcode: (row['Barcode'] || row['barcode'] || '').toString().trim(),
                        bulkUnit: '', priceBulk: 0, costBulk: 0, stockBulk: 0, qtyPerBulk: 1,
                        minStockAlert: 10, images: [], image: '',
                    };
                }).filter(Boolean);

                if (!mapped.length) { setBulkError('Tidak ada data valid. Pastikan kolom "Nama Barang" terisi.'); return; }
                setBulkPreview(mapped);
            } catch (err) {
                setBulkError('Gagal membaca file. Pastikan file berformat Excel (.xlsx/.xls) atau CSV.');
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = '';
    };

    const handleBulkImport = () => {
        if (!bulkPreview?.length) return;
        addBulkProducts(bulkPreview);
        setBulkPreview(null);
        setShowBulkUpload(false);
    };

    return (
        <div>
            {/* Toolbar */}
            <div className="toolbar" style={{ flexWrap: 'wrap' }}>
                <div className="search-box">
                    <Search size={18} />
                    <input type="text" placeholder="Cari nama, kategori, barcode..."
                        value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <select className="filter-select" value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}>
                    <option value="">Semua Kategori</option>
                    {uniqueCategories.map((cat, i) => <option key={i} value={cat}>{cat}</option>)}
                </select>
                <select className="filter-select" value={filterUnit}
                    onChange={(e) => setFilterUnit(e.target.value)}
                    style={{ minWidth: 120, maxWidth: 160, fontSize: '0.82rem' }}>
                    <option value="">Semua Satuan</option>
                    {uniqueUnits.map((u, i) => <option key={i} value={u}>{u.toUpperCase()}</option>)}
                </select>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowCost(!showCost)}
                    title={showCost ? 'Sembunyikan Modal' : 'Tampilkan Modal'}>
                    {showCost ? <EyeOff size={16} /> : <Eye size={16} />}
                    <span className="hide-mobile">{showCost ? ' Sembunyikan' : ' Lihat Modal'}</span>
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowExport(true)}>
                    <Printer size={16} /> <span className="hide-mobile">Export</span>
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowBulkUpload(true)}>
                    <FileSpreadsheet size={16} /> <span className="hide-mobile">Upload Massal</span>
                </button>
                {barcodeQueue.length > 0 && (
                    <button className="btn btn-sm" onClick={() => setShowBarcodeModal(true)} style={{ background: 'var(--accent-gold)', color: '#111', fontWeight: 600 }}>
                        <Printer size={16} /> Cetak Barcode ({barcodeQueue.length})
                    </button>
                )}
                <button className="btn btn-primary" onClick={() => { setEditProduct(null); setDuplicateProduct(null); setShowForm(true); }}>
                    <Plus size={18} /> Tambah Barang
                </button>
            </div>

            {/* Card Grid */}
            {filteredProducts.length === 0 ? (
                <div className="empty-state">
                    <Package size={56} />
                    <p>{products.length === 0 ? 'Belum ada barang. Klik "Tambah Barang" untuk mulai.' : 'Tidak ada barang yang cocok.'}</p>
                </div>
            ) : (
                <div className="product-card-grid">
                    {filteredProducts.map((product, i) => {
                        const unit = product.unit || 'pcs';
                        const bulk = product.bulkUnit || '';
                        const totalStock = getStockTotal(product);
                        const isOut = totalStock === 0;
                        const isLow = totalStock > 0 && totalStock <= (product.minStockAlert || 10);
                        const priceUnit = product.priceUnit ?? product.pricePcs ?? 0;
                        const costUnit = product.costUnit || 0;
                        const profit = costUnit > 0 ? priceUnit - costUnit : 0;
                        const images = product.images || (product.image ? [product.image] : []);

                        return (
                            <div key={product.id} className="product-card" style={{ animationDelay: `${i * 0.03}s` }}
                                onClick={() => setDetailProduct(product)}>
                                <div className="product-card-img">
                                    {images.length > 0 ? (
                                        <img src={images[0]} alt={product.name}
                                            onClick={(e) => { e.stopPropagation(); setEnlargedImage({ images, index: 0 }); }} />
                                    ) : (
                                        <div className="product-card-img-placeholder">
                                            <Package size={28} color="var(--text-muted)" />
                                        </div>
                                    )}
                                    {images.length > 1 && <span className="product-card-img-count">+{images.length - 1}</span>}
                                    <span className={`product-card-stock-badge ${isOut ? 'danger' : isLow ? 'warning' : 'safe'}`}>
                                        {isOut ? 'HABIS' : `${totalStock} ${unit}`}
                                    </span>
                                </div>
                                <div className="product-card-body">
                                    <div className="product-card-name">{product.name}</div>
                                    <div className="product-card-meta">
                                        <span className="category-badge" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>{product.category}</span>
                                        {product.size && (
                                            <span style={{
                                                fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-blue)',
                                                background: 'var(--accent-blue-dim)', padding: '1px 6px', borderRadius: 4
                                            }}>
                                                {product.size}
                                            </span>
                                        )}
                                    </div>
                                    {product.description && (
                                        <div style={{
                                            fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.3,
                                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                                        }}>
                                            {product.description}
                                        </div>
                                    )}
                                    <div className="product-card-price">
                                        <span className="product-card-price-main">{formatRupiah(priceUnit)}<small>/{unit}</small></span>
                                    </div>
                                    {showCost && costUnit > 0 && (
                                        <div className="product-card-cost">
                                            <span style={{ color: 'var(--accent-orange)' }}>Modal: {formatRupiah(costUnit)}</span>
                                            {profit > 0 && <span style={{ color: 'var(--accent-green)' }}>Laba: {formatRupiah(profit)}</span>}
                                        </div>
                                    )}
                                    {(product.qtyPerUnit || product.qtyPerBulk || 0) > 0 && (
                                        <div style={{
                                            fontSize: '0.72rem', color: 'var(--accent-gold)',
                                            background: 'var(--accent-gold-dim)', padding: '2px 8px',
                                            borderRadius: 4, display: 'inline-block', fontWeight: 600
                                        }}>
                                            📦 Isi: {product.qtyPerUnit || product.qtyPerBulk} per 1 {unit}
                                        </div>
                                    )}
                                    <div className="product-card-footer">
                                        {product.location && (
                                            <span className="location-tag" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                                                <MapPin size={10} /> {product.location}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="product-card-actions" onClick={e => e.stopPropagation()}>
                                    {addToCart && (
                                        <button className="btn-icon" title="Tambah ke Keranjang"
                                            onClick={() => {
                                                const ok = addToCart(product);
                                                if (ok) {
                                                    setToastMessage(`✅ ${product.name} ditambahkan ke keranjang`);
                                                    setTimeout(() => setToastMessage(''), 2500);
                                                } else {
                                                    setToastMessage(`⚠️ ${product.name} stok habis!`);
                                                    setTimeout(() => setToastMessage(''), 2500);
                                                }
                                            }}
                                            style={{ color: 'var(--accent-gold)' }}>
                                            <ShoppingCart size={14} />
                                        </button>
                                    )}
                                    <button className="btn-icon" onClick={() => handleEdit(product)} title="Edit"><Edit size={14} /></button>
                                    <button className="btn-icon" onClick={() => handleDuplicate(product)} title="Duplikat"><Copy size={14} /></button>
                                    <button
                                        className="btn-icon"
                                        onClick={() => handleToggleBarcodeQueue(product)}
                                        title={barcodeQueue.some(item => item.product.id === product.id) ? "Hapus dari Antrean Barcode" : "Tambah ke Antrean Barcode"}
                                        style={{ color: barcodeQueue.some(item => item.product.id === product.id) ? 'var(--accent-gold)' : 'var(--text-muted)' }}
                                    >
                                        <Barcode size={14} />
                                    </button>
                                    <button className="btn-icon" onClick={() => handleDelete(product)} title="Hapus" style={{ color: 'var(--accent-red)' }}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modals */}
            {showForm && <ProductForm product={editProduct || duplicateProduct} onClose={handleCloseForm} isDuplicate={!!duplicateProduct} />}
            {detailProduct && (
                <ProductDetail product={detailProduct} onClose={() => setDetailProduct(null)}
                    onEdit={(p) => { setDetailProduct(null); handleEdit(p); }}
                    onDuplicate={(p) => { setDetailProduct(null); handleDuplicate(p); }}
                    onToggleBarcodeQueue={(p) => { handleToggleBarcodeQueue(p); }}
                    isInBarcodeQueue={detailProduct && barcodeQueue.some(item => item.product.id === detailProduct.id)}
                    onDelete={(p) => { setDetailProduct(null); handleDelete(p); }}
                    addToCart={addToCart} />
            )}

            {/* Image Viewer with Arrows */}
            {enlargedImage && (
                <div className="modal-overlay" onClick={() => setEnlargedImage(null)} style={{ zIndex: 9999 }}>
                    <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh', display: 'flex', alignItems: 'center', gap: 12 }}
                        onClick={e => e.stopPropagation()}>
                        {/* Left Arrow */}
                        {enlargedImage.images.length > 1 && (
                            <button className="btn-icon" onClick={() => setEnlargedImage(prev => ({
                                ...prev, index: (prev.index - 1 + prev.images.length) % prev.images.length
                            }))}
                                style={{ background: 'rgba(0,0,0,0.6)', borderRadius: '50%', padding: 10, color: '#fff', flexShrink: 0 }}>
                                <ChevronLeft size={24} />
                            </button>
                        )}
                        <div style={{ position: 'relative' }}>
                            <img src={enlargedImage.images[enlargedImage.index]} alt="Enlarged"
                                style={{ maxWidth: '80vw', maxHeight: '80vh', borderRadius: 8, objectFit: 'contain' }} />
                            <div style={{ position: 'absolute', top: 10, right: 10 }}>
                                <button className="btn-icon" onClick={() => setEnlargedImage(null)}
                                    style={{ background: 'rgba(0,0,0,0.6)', borderRadius: '50%', padding: 6, color: '#fff' }}>
                                    <X size={20} />
                                </button>
                            </div>
                            {/* Counter */}
                            {enlargedImage.images.length > 1 && (
                                <div style={{
                                    position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
                                    background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '4px 12px', borderRadius: 20, fontSize: '0.82rem',
                                    fontWeight: 600
                                }}>
                                    {enlargedImage.index + 1} / {enlargedImage.images.length}
                                </div>
                            )}
                        </div>
                        {/* Right Arrow */}
                        {enlargedImage.images.length > 1 && (
                            <button className="btn-icon" onClick={() => setEnlargedImage(prev => ({
                                ...prev, index: (prev.index + 1) % prev.images.length
                            }))}
                                style={{ background: 'rgba(0,0,0,0.6)', borderRadius: '50%', padding: 10, color: '#fff', flexShrink: 0 }}>
                                <ChevronRight size={24} />
                            </button>
                        )}
                    </div>
                    {/* Thumbnails */}
                    {enlargedImage.images.length > 1 && (
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16, position: 'absolute', bottom: 20 }}>
                            {enlargedImage.images.map((img, i) => (
                                <img key={i} src={img} alt={`Thumb ${i}`}
                                    style={{
                                        width: 52, height: 52, borderRadius: 6, objectFit: 'cover', cursor: 'pointer',
                                        border: i === enlargedImage.index ? '3px solid var(--accent-gold)' : '3px solid transparent',
                                        opacity: i === enlargedImage.index ? 1 : 0.6
                                    }}
                                    onClick={(e) => { e.stopPropagation(); setEnlargedImage({ ...enlargedImage, index: i }); }} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Bulk Upload Modal */}
            {showBulkUpload && (
                <div className="modal-overlay" onClick={() => { setShowBulkUpload(false); setBulkPreview(null); setBulkError(''); }}>
                    <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>📊 Upload Massal via Excel</h3>
                            <button className="btn-icon" onClick={() => { setShowBulkUpload(false); setBulkPreview(null); setBulkError(''); }}><X size={18} /></button>
                        </div>
                        <div className="modal-body">
                            {!bulkPreview ? (
                                <>
                                    <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
                                        <FileSpreadsheet size={48} color="var(--accent-green)" style={{ marginBottom: 12 }} />
                                        <h4 style={{ color: 'var(--text-heading)', marginBottom: 6 }}>Import Barang dari Spreadsheet</h4>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                                            Buat file Excel/CSV dengan header kolom berikut di baris pertama, lalu upload.
                                        </p>
                                    </div>

                                    {/* Step 1: Header columns */}
                                    <div style={{ padding: '14px 16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', marginBottom: 12 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-heading)' }}>1️⃣ Header Kolom</div>
                                            <button className="btn btn-secondary btn-sm" onClick={copyHeaders}
                                                style={{ fontSize: '0.75rem' }}>
                                                {headerCopied ? '✅ Tersalin!' : '📋 Salin Header'}
                                            </button>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                            {TEMPLATE_HEADERS.map((h, i) => (
                                                <span key={i} style={{
                                                    padding: '4px 10px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600,
                                                    background: i < 2 ? 'var(--accent-gold-dim)' : 'var(--bg-input)',
                                                    color: i < 2 ? 'var(--accent-gold)' : 'var(--text-secondary)',
                                                    border: `1px solid ${i < 2 ? 'rgba(245,158,11,0.3)' : 'var(--border-color)'}`
                                                }}>
                                                    {h}{i < 2 ? ' *' : ''}
                                                </span>
                                            ))}
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 8 }}>
                                            * Wajib diisi. Klik "Salin Header" lalu paste di baris pertama spreadsheet Anda.
                                        </div>
                                    </div>

                                    {/* Step 2: Upload */}
                                    <div style={{
                                        padding: '14px 16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)',
                                        marginBottom: 12
                                    }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-heading)', marginBottom: 8 }}>2️⃣ Upload File</div>
                                        <div style={{
                                            border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-sm)',
                                            padding: '24px 16px', textAlign: 'center', cursor: 'pointer', position: 'relative',
                                            transition: 'all var(--transition-fast)'
                                        }}
                                            onClick={() => fileInputRef.current?.click()}>
                                            <Upload size={28} color="var(--text-muted)" style={{ marginBottom: 8 }} />
                                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                                Klik untuk pilih file
                                            </p>
                                            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                                Mendukung .xlsx, .xls, dan .csv
                                            </p>
                                            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv"
                                                onChange={handleFileUpload} style={{ display: 'none' }} />
                                        </div>
                                    </div>

                                    {bulkError && (
                                        <div style={{
                                            padding: '10px 14px', background: 'var(--accent-red-dim)', color: 'var(--accent-red)',
                                            borderRadius: 'var(--radius-sm)', fontSize: '0.82rem'
                                        }}>
                                            ⚠️ {bulkError}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    {/* Preview */}
                                    <div style={{ marginBottom: 12 }}>
                                        <h4 style={{ color: 'var(--text-heading)', marginBottom: 8 }}>
                                            ✅ {bulkPreview.length} barang siap diimport
                                        </h4>
                                    </div>
                                    <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                            <thead>
                                                <tr style={{ background: 'var(--bg-secondary)', position: 'sticky', top: 0 }}>
                                                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>#</th>
                                                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Nama</th>
                                                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Kategori</th>
                                                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Harga</th>
                                                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Stok</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {bulkPreview.map((item, i) => (
                                                    <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                        <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>{i + 1}</td>
                                                        <td style={{ padding: '6px 10px', fontWeight: 600 }}>{item.name}</td>
                                                        <td style={{ padding: '6px 10px' }}>{item.category}</td>
                                                        <td style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--accent-gold)' }}>{formatRupiah(item.priceUnit)}</td>
                                                        <td style={{ padding: '6px 10px', textAlign: 'right' }}>{item.stockUnit} {item.unit}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => { if (bulkPreview) { setBulkPreview(null); } else { setShowBulkUpload(false); } }}>
                                {bulkPreview ? '← Kembali' : 'Batal'}
                            </button>
                            {bulkPreview && (
                                <button className="btn btn-primary" onClick={handleBulkImport}>
                                    <Upload size={16} /> Import {bulkPreview.length} Barang
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Export Modal */}
            {showExport && (
                <div className="modal-overlay" onClick={() => setShowExport(false)}>
                    <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>📥 Export Data Barang</h3>
                            <button className="btn-icon" onClick={() => setShowExport(false)}><X size={18} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Pilih Kategori</label>
                                <select className="form-control" value={exportCategory}
                                    onChange={e => setExportCategory(e.target.value)}>
                                    <option value="">📦 Semua Kategori ({products.length} barang)</option>
                                    {uniqueCategories.map((cat, i) => {
                                        const count = products.filter(p => p.category === cat).length;
                                        return <option key={i} value={cat}>{cat} ({count} barang)</option>;
                                    })}
                                </select>
                            </div>

                            {/* Action buttons */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                                <button className="btn btn-primary" onClick={printExportData}
                                    disabled={getExportData().length === 0}
                                    style={{ padding: '14px 12px', flexDirection: 'column', gap: 6, display: 'flex', alignItems: 'center' }}>
                                    <Printer size={22} />
                                    <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Cetak / PDF</span>
                                    <span style={{ fontSize: '0.68rem', opacity: 0.8, fontWeight: 400 }}>Print atau simpan sebagai PDF</span>
                                </button>
                                <button className="btn btn-secondary" onClick={copyExportData}
                                    disabled={getExportData().length === 0}
                                    style={{ padding: '14px 12px', flexDirection: 'column', gap: 6, display: 'flex', alignItems: 'center' }}>
                                    <ClipboardCopy size={22} />
                                    <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                                        {exportCopied ? '✅ Tersalin!' : 'Salin Data'}
                                    </span>
                                    <span style={{ fontSize: '0.68rem', opacity: 0.8, fontWeight: 400 }}>Paste ke Excel / Sheets</span>
                                </button>
                            </div>

                            {/* Preview */}
                            <div style={{
                                fontSize: '0.75rem', color: 'var(--text-muted)', padding: '10px 12px',
                                background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)'
                            }}>
                                <strong>📋 {getExportData().length} barang</strong> akan di-export
                                {exportCategory && <span> dari kategori "{exportCategory}"</span>}
                                <br />Kolom: No, Nama, Kategori, Ukuran, Satuan, Harga Jual, Harga Modal, Stok, Lokasi, Barcode
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowExport(false)}>Tutup</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Barcode Settings Modal */}
            {showBarcodeModal && barcodeQueue.length > 0 && (
                <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowBarcodeModal(false)}>
                    <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>🏷️ Cetak Barcode Massal</h3>
                            <button className="btn-icon" onClick={() => setShowBarcodeModal(false)}><X size={18} /></button>
                        </div>
                        <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 1fr) 280px', gap: 20 }}>
                            {/* Left Col: Queue List */}
                            <div>
                                <h4 style={{ fontSize: '0.85rem', marginBottom: 12, color: 'var(--text-heading)' }}>📦 Daftar Antrean ({barcodeQueue.length} Barang)</h4>
                                <div style={{ maxHeight: 350, overflowY: 'auto', paddingRight: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {barcodeQueue.map((item) => (
                                        <div key={item.product.id} style={{
                                            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                                            padding: '10px 12px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: 10
                                        }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.product.name}</div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{item.product.barcode || '-'}</div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Qty:</label>
                                                <input type="number" min="1" max="500" value={item.qty}
                                                    onChange={e => handleUpdateQueueQty(item.product.id, Number(e.target.value) || 1)}
                                                    style={{ width: 50, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border-color)', fontSize: '0.8rem', textAlign: 'center' }} />
                                            </div>
                                            <button className="btn-icon" onClick={() => handleRemoveFromQueue(item.product.id)} title="Hapus dari antrean">
                                                <Trash2 size={14} color="var(--accent-red)" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Right Col: Settings & Preview */}
                            <div>
                                <h4 style={{ fontSize: '0.85rem', marginBottom: 12, color: 'var(--text-heading)' }}>👁️ Pratinjau & Pengaturan</h4>
                                {/* Preview */}
                                <div style={{
                                    background: '#fff', borderRadius: 'var(--radius-sm)', padding: '12px',
                                    marginBottom: 16, textAlign: 'center', border: '1px solid var(--border-color)'
                                }}>
                                    <div style={{ fontSize: '7pt', fontWeight: 'bold', color: '#000' }}>
                                        {barcodeSettings.showStoreName && (storeSettings?.storeName || 'Toko Jakarta Baut')}
                                    </div>
                                    {barcodeSettings.showProductName && (
                                        <div style={{ fontSize: '8pt', fontWeight: 'bold', color: '#000', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{barcodeQueue[0].product.name}</div>
                                    )}
                                    {barcodeSettings.showSize && barcodeQueue[0].product.size && (
                                        <div style={{ fontSize: '7pt', color: '#555' }}>{barcodeQueue[0].product.size}</div>
                                    )}
                                    {barcodeSettings.showQtyPerUnit && (barcodeQueue[0].product.qtyPerUnit || barcodeQueue[0].product.qtyPerBulk || 0) > 0 && (
                                        <div style={{ fontSize: '7pt', color: '#333', fontStyle: 'italic', marginTop: 2 }}>
                                            Isi: {barcodeQueue[0].product.qtyPerUnit || barcodeQueue[0].product.qtyPerBulk} per 1 {barcodeQueue[0].product.unit || 'pcs'}
                                        </div>
                                    )}
                                    {barcodeSettings.showPrice && (
                                        <div style={{ fontSize: '8pt', fontWeight: 'bold', color: '#000', marginTop: 2 }}>
                                            {formatRupiah(barcodeQueue[0].product.priceUnit ?? barcodeQueue[0].product.pricePcs ?? 0)} / {barcodeQueue[0].product.unit || 'pcs'}
                                        </div>
                                    )}
                                    {barcodeSettings.showBarcode && <svg ref={barcodeRef}></svg>}
                                </div>

                                {/* Sticker Size */}
                                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-heading)', marginBottom: 8 }}>📐 Ukuran Stiker (mm)</div>
                                <div className="form-row" style={{ marginBottom: 12 }}>
                                    <div className="form-group">
                                        <label>Lebar</label>
                                        <input className="form-control" type="number" min="10" max="200"
                                            value={barcodeSettings.labelWidth}
                                            onChange={e => setBarcodeSettings(s => ({ ...s, labelWidth: Number(e.target.value) || 50 }))} />
                                    </div>
                                    <div className="form-group">
                                        <label>Tinggi</label>
                                        <input className="form-control" type="number" min="10" max="200"
                                            value={barcodeSettings.labelHeight}
                                            onChange={e => setBarcodeSettings(s => ({ ...s, labelHeight: Number(e.target.value) || 30 }))} />
                                    </div>
                                    <div className="form-group">
                                        <label>Kolom</label>
                                        <input className="form-control" type="number" min="1" max="10"
                                            value={barcodeSettings.columns}
                                            onChange={e => setBarcodeSettings(s => ({ ...s, columns: Number(e.target.value) || 3 }))} />
                                    </div>
                                </div>

                                {/* Gap */}
                                <div className="form-row" style={{ marginBottom: 16 }}>
                                    <div className="form-group">
                                        <label>Jarak Horizontal (mm)</label>
                                        <input className="form-control" type="number" min="0" max="20"
                                            value={barcodeSettings.gapX}
                                            onChange={e => setBarcodeSettings(s => ({ ...s, gapX: Number(e.target.value) || 0 }))} />
                                    </div>
                                    <div className="form-group">
                                        <label>Jarak Vertikal (mm)</label>
                                        <input className="form-control" type="number" min="0" max="20"
                                            value={barcodeSettings.gapY}
                                            onChange={e => setBarcodeSettings(s => ({ ...s, gapY: Number(e.target.value) || 0 }))} />
                                    </div>
                                </div>

                                {/* Toggle Fields */}
                                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-heading)', marginBottom: 8, marginTop: 16 }}>📝 Tampilkan di Stiker</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                                    {[
                                        { key: 'showStoreName', label: 'Nama Toko' },
                                        { key: 'showProductName', label: 'Nama Barang' },
                                        { key: 'showSize', label: 'Ukuran / Spesifikasi' },
                                        { key: 'showQtyPerUnit', label: 'Info Isi per Paket/Satuan' },
                                        { key: 'showPrice', label: 'Harga Jual' },
                                        { key: 'showBarcode', label: 'Barcode' },
                                    ].map(opt => (
                                        <label key={opt.key} style={{
                                            display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px',
                                            background: barcodeSettings[opt.key] ? 'var(--accent-gold-dim)' : 'transparent',
                                            border: `1px solid ${barcodeSettings[opt.key] ? 'rgba(240,185,11,0.3)' : 'transparent'}`,
                                            borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.78rem'
                                        }}>
                                            <input type="checkbox" checked={barcodeSettings[opt.key]}
                                                onChange={e => setBarcodeSettings(s => ({ ...s, [opt.key]: e.target.checked }))} />
                                            <span style={{ color: barcodeSettings[opt.key] ? 'var(--accent-gold)' : 'var(--text-muted)' }}>{opt.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowBarcodeModal(false)}>Batal</button>
                            <button className="btn btn-primary" onClick={executePrint}>
                                <Printer size={16} /> Cetak {barcodeQueue.reduce((acc, item) => acc + item.qty, 0)} Label
                            </button>
                        </div>
                    </div>
                </div>
            )}



            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
                    <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>🗑️ Hapus Barang</h3>
                            <button className="btn-icon" onClick={() => setDeleteConfirm(null)}><X size={18} /></button>
                        </div>
                        <div className="modal-body" style={{ textAlign: 'center' }}>
                            <div style={{
                                width: 60, height: 60, borderRadius: '50%', background: 'var(--accent-red-dim)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
                            }}>
                                <Trash2 size={28} color="var(--accent-red)" />
                            </div>
                            <p style={{ color: 'var(--text-heading)', fontWeight: 600, fontSize: '1rem', marginBottom: 8 }}>
                                Yakin hapus "{deleteConfirm.name}"?
                            </p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                Barang ini akan dihapus permanen dan tidak bisa dikembalikan.
                            </p>
                        </div>
                        <div className="modal-footer" style={{ justifyContent: 'center', gap: 12 }}>
                            <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Batal</button>
                            <button className="btn" onClick={confirmDelete}
                                style={{ background: 'var(--accent-red)', color: '#fff' }}>
                                <Trash2 size={16} /> Ya, Hapus
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Notification */}
            {toastMessage && (
                <div style={{
                    position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
                    background: 'var(--bg-card)', color: 'var(--text-primary)',
                    padding: '12px 24px', borderRadius: 'var(--radius-sm)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.4)', border: '1px solid var(--border-color)',
                    fontSize: '0.88rem', fontWeight: 600, zIndex: 10000,
                    animation: 'slideUp 0.3s ease',
                }}>
                    {toastMessage}
                </div>
            )}
        </div>
    );
}
