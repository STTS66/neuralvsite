import { useEffect, useMemo, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import BanOverlay from './components/BanOverlay';
import Footer from './components/Footer';
import Starfield from './components/Starfield';
import SupportWidget from './components/SupportWidget';
import Home from './pages/Home';
import Guide from './pages/Guide';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import Rules from './pages/Rules';
import Agreement from './pages/Agreement';
import { API, USER_BANNED_EVENT, type BannedUserEventDetail, type UserProfileResponse } from './api';

type ActiveBanState = {
  isBanned: true;
  message: string;
  bannedUntil: string | null;
  banReason: string | null;
};

function createBanState(profile?: UserProfileResponse | null): ActiveBanState | null {
  if (!profile) {
    return null;
  }

  const bannedUntil = profile.bannedUntil || profile.banned_until || null;
  const expiresAt = bannedUntil ? new Date(bannedUntil).getTime() : 0;
  const isActiveBan =
    Boolean(profile.isBanned) || (Boolean(expiresAt) && !Number.isNaN(expiresAt) && expiresAt > Date.now());

  if (!isActiveBan) {
    return null;
  }

  return {
    isBanned: true,
    message:
      profile.banMessage ||
      'Ваш аккаунт временно заблокирован администрацией. Доступ к функциям сайта ограничен.',
    bannedUntil,
    banReason: profile.banReason || profile.ban_reason || null,
  };
}

function App() {
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [banState, setBanState] = useState<ActiveBanState | null>(null);
  const isAuthenticated = Boolean(localStorage.getItem('neuralv_id'));
  const currentUserId = useMemo(() => localStorage.getItem('neuralv_id'), [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated && isSupportOpen) {
      setIsSupportOpen(false);
    }
  }, [isAuthenticated, isSupportOpen]);

  useEffect(() => {
    if (!isAuthenticated || !currentUserId) {
      setBanState(null);
      return;
    }

    let isMounted = true;

    const syncBanState = async () => {
      const profile = await API.getUserProfile(currentUserId);
      if (!isMounted) {
        return;
      }

      setBanState(createBanState(profile));
    };

    const handleBannedEvent = (event: Event) => {
      const { detail } = event as CustomEvent<BannedUserEventDetail>;

      setBanState({
        isBanned: true,
        message:
          detail?.message ||
          'Ваш аккаунт временно заблокирован администрацией. Доступ к функциям сайта ограничен.',
        bannedUntil: detail?.bannedUntil || null,
        banReason: detail?.banReason || null,
      });
      setIsSupportOpen(false);
    };

    void syncBanState();

    const interval = window.setInterval(() => {
      void syncBanState();
    }, 15000);

    window.addEventListener(USER_BANNED_EVENT, handleBannedEvent as EventListener);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
      window.removeEventListener(USER_BANNED_EVENT, handleBannedEvent as EventListener);
    };
  }, [currentUserId, isAuthenticated]);

  useEffect(() => {
    if (banState?.isBanned && isSupportOpen) {
      setIsSupportOpen(false);
    }
  }, [banState, isSupportOpen]);

  const handleLogout = () => {
    localStorage.removeItem('neuralv_id');
    localStorage.removeItem('neuralv_username');
    localStorage.removeItem('neuralv_role');
    setIsSupportOpen(false);
    setBanState(null);
    window.location.href = '/login';
  };

  return (
    <div className="page-container">
      <Starfield />
      <Navbar
        canUseSupport={isAuthenticated && !banState?.isBanned}
        onSupportOpen={() => {
          if (isAuthenticated && !banState?.isBanned) {
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
          <Route path="/rules" element={<Rules />} />
          <Route path="/agreement" element={<Agreement />} />
        </Routes>
      </main>
      <Footer />
      {isAuthenticated && !banState?.isBanned && (
        <SupportWidget isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} />
      )}
      {isAuthenticated && banState?.isBanned ? (
        <BanOverlay
          message={banState.message}
          bannedUntil={banState.bannedUntil}
          banReason={banState.banReason}
          onLogout={handleLogout}
        />
      ) : null}
    </div>
  );
}

export default App;
