import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import {
    LayoutDashboard, Package, ShoppingCart, History, Menu, X, Clock
} from 'lucide-react';

const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory', label: 'Inventaris', icon: Package },
    { id: 'pos', label: 'Kasir (POS)', icon: ShoppingCart },
    { id: 'history', label: 'Riwayat', icon: History },
];

export default function Layout({ currentPage, onNavigate, cartCount = 0, children }) {
    const { storeSettings } = useStore();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const formatTime = (date) => date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const formatDate = (date) => date.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const pageTitle = navItems.find(n => n.id === currentPage)?.label || 'Dashboard';

    return (
        <div className="app-container">
            <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
                <Menu size={20} />
            </button>

            {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

            <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-brand">
                    <h1>⚙️ {storeSettings?.storeName?.split(' ').slice(-2).join(' ') || 'Jakarta Baut'}</h1>
                    <p>SISTEM MANAJEMEN TOKO</p>
                </div>
                <nav className="sidebar-nav">
                    {navItems.map(item => (
                        <button key={item.id}
                            className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
                            onClick={() => { onNavigate(item.id); setSidebarOpen(false); }}>
                            <item.icon size={20} /> {item.label}
                            {item.id === 'pos' && cartCount > 0 && (
                                <span style={{
                                    marginLeft: 'auto', background: 'var(--accent-gold)', color: '#111',
                                    fontSize: '0.68rem', fontWeight: 800, borderRadius: 10,
                                    padding: '1px 7px', minWidth: 20, textAlign: 'center',
                                }}>{cartCount}</span>
                            )}
                        </button>
                    ))}
                </nav>
                <div className="sidebar-footer">
                    <p>{storeSettings?.storeName || 'Toko Jakarta Baut'}</p>
                    <p>{storeSettings?.storeAddress || ''}</p>
                </div>
            </aside>

            <main className="main-content">
                <header className="page-header">
                    <h2>{pageTitle}</h2>
                    <div className="header-time">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Clock size={16} />
                            <div>
                                <div style={{ fontWeight: 600 }}>{formatTime(currentTime)}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDate(currentTime)}</div>
                            </div>
                        </div>
                    </div>
                </header>
                <div className="page-body">{children}</div>
            </main>
        </div>
    );
}
