import React, { useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Header from './components/Header';
import SearchPage from './components/SearchPage';
import ProductPage from './components/ProductPage';
import CartPage from './components/CartPage';
import { CartProvider } from './components/CartContext';
import HeroPage from './components/HeroPage';
import Footer from './components/Footer';

// Dashboard imports
import {
  DashboardLayout,
  DashboardAuthProvider,
  DashboardLogin,
  DashboardOverview,
  SchemaBuilder,
  IndicesPage,
  IndexDetails,
  APIKeysPage,
  WebhooksPage
} from './dashboard';

const App = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchMode, setSearchMode] = useState('text');
  const [selectedImage, setSelectedImage] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [glowActive, setGlowActive] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardAuthProvider>
        <CartProvider>
          {/* <Header
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            searchMode={searchMode}
            setSearchMode={setSearchMode}
            selectedImage={selectedImage}
            setSelectedImage={setSelectedImage}
            isDragOver={isDragOver}
            setIsDragOver={setIsDragOver}
            glowActive={glowActive}
            setGlowActive={setGlowActive}
            navigate={navigate}
          /> */}
          <main className="flex-grow bg-gray-50">
            <Routes>
              {/* Main App Routes */}
              <Route path="/" element={<HeroPage />} />
              <Route path="/search" element={<SearchPage
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                searchMode={searchMode}
                setSearchMode={setSearchMode}
                selectedImage={selectedImage}
                setSelectedImage={setSelectedImage}
                isDragOver={isDragOver}
                setIsDragOver={setIsDragOver}
                glowActive={glowActive}
                setGlowActive={setGlowActive}
                navigate={navigate}
              />} />
              <Route path="/product/:id" element={<ProductPage />} />
              <Route path="/cart" element={<CartPage />} />
              
              {/* Dashboard Routes */}
              <Route path="/dashboard/login" element={<DashboardLogin />} />
              <Route path="/dashboard" element={<DashboardLayout />}>
                <Route index element={<DashboardOverview />} />
                <Route path="indices" element={<IndicesPage />} />
                <Route path="indices/new" element={<SchemaBuilder />} />
                <Route path="indices/:name" element={<IndexDetails />} />
                <Route path="indices/:name/edit" element={<SchemaBuilder />} />
                <Route path="api-keys" element={<APIKeysPage />} />
                <Route path="webhooks" element={<WebhooksPage />} />
                <Route path="analytics" element={<div className="p-8"><h1 className="text-2xl font-bold">Analytics</h1><p className="text-gray-500">Coming soon...</p></div>} />
                <Route path="settings" element={<div className="p-8"><h1 className="text-2xl font-bold">Settings</h1><p className="text-gray-500">Coming soon...</p></div>} />
              </Route>
            </Routes>
          </main>
          {/* <Footer /> */}
        </CartProvider>
      </DashboardAuthProvider>
    </div>
  );
};

export default App;