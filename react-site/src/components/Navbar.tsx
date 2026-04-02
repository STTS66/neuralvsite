import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Headset, LogOut, Menu, Shield, User, X } from 'lucide-react';
import './Navbar.css';

interface NavbarProps {
  onSupportOpen: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onSupportOpen }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const navigate = useNavigate();

  const role = localStorage.getItem('neuralv_role');

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('neuralv_id');
    localStorage.removeItem('neuralv_role');
    localStorage.removeItem('neuralv_username');
    setIsOpen(false);
    setShowDropdown(false);
    navigate('/');
  };

  const navLinks = [
    { name: 'ГЛАВНАЯ', path: '/' },
    { name: 'ГАЙД', path: '/guide' },
    { name: 'ПОДДЕРЖКА', action: 'support' as const },
  ];

  return (
    <>
      <motion.header
        className={`navbar ${isScrolled ? 'scrolled' : ''}`}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="nav-pill">
          <NavLink to="/" className="nav-brand">
            <Shield className="brand-icon" size={22} />
            <span className="brand-text">
              NEURAL<span className="brand-accent">V</span>
            </span>
          </NavLink>

          <nav className="nav-center">
            {navLinks.map((link) =>
              link.action === 'support' ? (
                <button
                  key={link.name}
                  type="button"
                  className="nav-link nav-link-button"
                  onClick={onSupportOpen}
                >
                  {link.name}
                </button>
              ) : (
                <NavLink
                  key={link.path}
                  to={link.path}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  {link.name}
                </NavLink>
              ),
            )}
          </nav>

          <div className="nav-actions">
            <button type="button" className="nav-btn nav-btn-support" onClick={onSupportOpen}>
              <Headset size={16} />
              <span>Поддержка</span>
            </button>

            {role ? (
              <div className="user-menu-container">
                <div
                  className="nav-user-trigger"
                  onClick={() => setShowDropdown(!showDropdown)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setShowDropdown((current) => !current);
                    }
                  }}
                >
                  <span className="nav-username">{localStorage.getItem('neuralv_username')}</span>
                  <div className="avatar-tiktok">
                    <User size={20} color="#fff" />
                  </div>
                </div>

                <AnimatePresence>
                  {showDropdown && (
                    <motion.div
                      className="user-dropdown glass-panel"
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                    >
                      <NavLink
                        to={role === 'admin' ? '/admin' : '/dashboard'}
                        className="dropdown-item"
                        onClick={() => setShowDropdown(false)}
                      >
                        {role === 'admin' ? 'АДМИН-ПАНЕЛЬ' : 'КАБИНЕТ'}
                      </NavLink>
                      <button onClick={handleLogout} className="dropdown-item text-danger" type="button">
                        <LogOut size={16} /> ВЫХОД
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <NavLink to="/login" className="nav-btn nav-btn-auth">
                <User size={16} />
                <span>ВХОД</span>
              </NavLink>
            )}
          </div>

          <button className="hamburger" onClick={() => setIsOpen(!isOpen)} type="button">
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </motion.header>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="mobile-menu"
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            <div className="mobile-nav-items">
              {navLinks.map((link) =>
                link.action === 'support' ? (
                  <button
                    key={link.name}
                    type="button"
                    className="mobile-nav-item mobile-nav-button"
                    onClick={() => {
                      setIsOpen(false);
                      onSupportOpen();
                    }}
                  >
                    {link.name}
                  </button>
                ) : (
                  <NavLink
                    key={link.path}
                    to={link.path}
                    className="mobile-nav-item"
                    onClick={() => setIsOpen(false)}
                  >
                    {link.name}
                  </NavLink>
                ),
              )}

              {role ? (
                <button onClick={handleLogout} className="mobile-nav-item logout-text" type="button">
                  ВЫХОД
                </button>
              ) : (
                <NavLink to="/login" className="mobile-nav-item auth-text" onClick={() => setIsOpen(false)}>
                  ВХОД
                </NavLink>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
