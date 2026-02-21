import React, { useState, useCallback } from 'react';
import { StoreProvider } from './context/StoreContext';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import ProductList from './components/ProductList';
import POS from './components/POS';
import TransactionHistory from './components/TransactionHistory';
import { getStockTotal } from './context/StoreContext';
import './styles/App.css';

function App() {
    const [currentPage, setCurrentPage] = useState('dashboard');

    // Multi-cart state management
    const [carts, setCarts] = useState([
        { id: Date.now(), name: 'Pelanggan 1', items: [], customerName: '' }
    ]);
    const [activeCartId, setActiveCartId] = useState(carts[0].id);

    // Shared addToCart function — used by both POS and Inventory
    const addToCart = useCallback((product) => {
        const totalStock = getStockTotal(product);
        if (totalStock <= 0) return false;
        const unit = product.unit || 'pcs';
        const bulkUnit = product.bulkUnit || '';
        const priceUnit = product.priceUnit ?? product.pricePcs ?? 0;
        const priceBulk = product.priceBulk ?? product.priceBox ?? 0;

        setCarts(prevCarts => {
            return prevCarts.map(cart => {
                if (cart.id !== activeCartId) return cart;

                const existingItemIndex = cart.items.findIndex(item => item.productId === product.id);
                if (existingItemIndex >= 0) {
                    const newItems = [...cart.items];
                    newItems[existingItemIndex] = {
                        ...newItems[existingItemIndex],
                        quantity: newItems[existingItemIndex].quantity + 1
                    };
                    return { ...cart, items: newItems };
                } else {
                    return {
                        ...cart,
                        items: [...cart.items, {
                            productId: product.id, name: product.name, category: product.category,
                            primaryUnit: unit, bulkUnit, unit, quantity: 1,
                            priceUnit, priceBulk,
                            qtyPerBulk: product.qtyPerBulk || product.pcsPerBox || 1,
                            pricePerUnit: priceUnit, discountPercent: 0,
                        }]
                    };
                }
            });
        });
        return true;
    }, [activeCartId]); // Dependency on activeCartId is crucial here

    const renderPage = () => {
        switch (currentPage) {
            case 'dashboard': return <Dashboard />;
            case 'inventory': return <ProductList addToCart={addToCart} />;
            case 'pos': return (
                <POS
                    carts={carts}
                    setCarts={setCarts}
                    activeCartId={activeCartId}
                    setActiveCartId={setActiveCartId}
                    addToCart={addToCart}
                />
            );
            case 'history': return <TransactionHistory />;
            default: return <Dashboard />;
        }
    };

    return (
        <StoreProvider>
            {/* Compute total active cart count or total items to show in the sidebar */}
            <Layout currentPage={currentPage} onNavigate={setCurrentPage}
                cartCount={carts.find(c => c.id === activeCartId)?.items?.length || 0}>
                {renderPage()}
            </Layout>
        </StoreProvider>
    );
}

export default App;
