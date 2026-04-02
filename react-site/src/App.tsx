import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Starfield from './components/Starfield';
import SupportWidget from './components/SupportWidget';
import Home from './pages/Home';
import Guide from './pages/Guide';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';

function App() {
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const isAuthenticated = Boolean(localStorage.getItem('neuralv_id'));

  useEffect(() => {
    if (!isAuthenticated && isSupportOpen) {
      setIsSupportOpen(false);
    }
  }, [isAuthenticated, isSupportOpen]);

  return (
    <div className="page-container">
      <Starfield />
      <Navbar
        canUseSupport={isAuthenticated}
        onSupportOpen={() => {
          if (isAuthenticated) {
            setIsSupportOpen(true);
          }
        }}
      />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/guide" element={<Guide />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>
      <Footer />
      {isAuthenticated && (
        <SupportWidget isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} />
      )}
    </div>
  );
}

export default App;
