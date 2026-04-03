import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Key, Mail, Shield, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ADMIN_SESSION_STORAGE_KEY, API, clearStoredAuth } from '../api';
import './Login.css';

const Login: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isAwaitingVerification, setIsAwaitingVerification] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const resetMessages = () => {
    setErrorMsg('');
    setInfoMsg('');
  };

  const persistUser = (
    user: { id: number; username: string; role: string },
    adminSessionToken?: string | null,
  ) => {
    clearStoredAuth();
    localStorage.setItem('neuralv_id', String(user.id));
    localStorage.setItem('neuralv_username', user.username);
    localStorage.setItem('neuralv_role', user.role);

    if (user.role === 'admin' && adminSessionToken) {
      localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, adminSessionToken);
    }

    navigate(user.role === 'admin' ? '/admin' : '/');
    window.location.reload();
  };

  const handleLogin = async () => {
    const res = await API.loginUser(username, password);
    if (res.success) {
      if (res.user?.role === 'admin' && !res.adminSessionToken) {
        setErrorMsg('Не удалось создать защищённую админ-сессию. Попробуйте войти ещё раз.');
        return;
      }

      persistUser(res.user, res.adminSessionToken);
      return;
    }

    setErrorMsg(res.message || 'Ошибка входа.');
  };

  const handleRequestCode = async () => {
    if (password !== confirmPassword) {
      setErrorMsg('Пароли не совпадают.');
      return;
    }

    const res = await API.requestRegistrationCode(username, email, password);
    if (res.success) {
      setIsAwaitingVerification(true);
      setVerificationCode('');
      setInfoMsg(`Код отправлен на ${email}.`);
      return;
    }

    setErrorMsg(res.message || 'Не удалось отправить код.');
  };

  const handleVerifyCode = async () => {
    const res = await API.verifyRegistrationCode(email, verificationCode);
    if (res.success && res.user) {
      persistUser(res.user);
      return;
    }

    setErrorMsg(res.message || 'Не удалось подтвердить код.');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      if (isLogin) {
        await handleLogin();
      } else if (isAwaitingVerification) {
        await handleVerifyCode();
      } else {
        await handleRequestCode();
      }
    } finally {
      setLoading(false);
    }
  };

  const formVariants = {
    hidden: { opacity: 0, x: isLogin ? -30 : 30 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: 'easeOut' } },
    exit: { opacity: 0, x: isLogin ? 30 : -30, transition: { duration: 0.3 } },
  } as const;

  return (
    <div className="auth-container">
      <div className="bg-glow auth-glow" />

      <motion.div
        className="auth-card glass-panel"
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, type: 'spring', bounce: 0.4 }}
      >
        <div className="auth-header">
          <motion.div
            className="auth-icon"
            animate={{ rotate: isLogin ? 0 : 360 }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
          >
            <Shield size={40} />
          </motion.div>
          <h2 className="gradient-text">
            {isLogin
              ? 'Вход в систему'
              : isAwaitingVerification
                ? 'Подтверждение почты'
                : 'Регистрация'}
          </h2>
          <p className="auth-subtitle">
            {isLogin
              ? 'Войдите в аккаунт, чтобы пользоваться личным кабинетом и встроенной поддержкой.'
              : isAwaitingVerification
                ? 'Введите код из письма, чтобы завершить регистрацию.'
                : 'Создайте аккаунт, затем подтвердите email кодом из письма.'}
          </p>
        </div>

        <div className="auth-toggle">
          <button
            className={`toggle-btn ${isLogin ? 'active' : ''}`}
            onClick={() => {
              setIsLogin(true);
              setIsAwaitingVerification(false);
              resetMessages();
            }}
            type="button"
          >
            Войти
          </button>
          <button
            className={`toggle-btn ${!isLogin ? 'active' : ''}`}
            onClick={() => {
              setIsLogin(false);
              resetMessages();
            }}
            type="button"
          >
            Регистрация
          </button>
        </div>

        {errorMsg && <div className="auth-message auth-message-error">{errorMsg}</div>}
        {infoMsg && <div className="auth-message auth-message-info">{infoMsg}</div>}

        <AnimatePresence mode="wait">
          <motion.form
            key={isLogin ? 'login' : isAwaitingVerification ? 'verify' : 'register'}
            variants={formVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="auth-form"
            onSubmit={handleSubmit}
          >
            {!isAwaitingVerification && (
              <div className="input-group">
                <label>Имя пользователя</label>
                <div className="input-wrapper">
                  <User size={18} className="input-icon" />
                  <input
                    type="text"
                    className="input-base"
                    placeholder="Введите логин"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            {!isLogin && (
              <div className="input-group">
                <label>Email</label>
                <div className="input-wrapper">
                  <Mail size={18} className="input-icon" />
                  <input
                    type="email"
                    className="input-base"
                    placeholder="Введите email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    disabled={isAwaitingVerification}
                  />
                </div>
              </div>
            )}

            {isAwaitingVerification ? (
              <div className="input-group">
                <label>Код подтверждения</label>
                <div className="input-wrapper">
                  <Key size={18} className="input-icon" />
                  <input
                    type="text"
                    className="input-base"
                    placeholder="6 цифр из письма"
                    value={verificationCode}
                    onChange={(event) => setVerificationCode(event.target.value)}
                    maxLength={6}
                    required
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="input-group">
                  <label>Пароль</label>
                  <div className="input-wrapper">
                    <Key size={18} className="input-icon" />
                    <input
                      type="password"
                      className="input-base"
                      placeholder="Введите пароль"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />
                  </div>
                </div>

                {!isLogin && (
                  <div className="input-group">
                    <label>Повторите пароль</label>
                    <div className="input-wrapper">
                      <Key size={18} className="input-icon" />
                      <input
                        type="password"
                        className="input-base"
                        placeholder="Повторите пароль"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        required
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            <button type="submit" className="btn btn-primary submit-btn" disabled={loading}>
              {loading
                ? 'Обработка...'
                : isLogin
                  ? 'Войти'
                  : isAwaitingVerification
                    ? 'Подтвердить код'
                    : 'Получить код'}
              {!loading && <ArrowRight size={18} />}
            </button>

            {!isLogin && !isAwaitingVerification && (
              <p className="auth-legal-note">
                Создавая аккаунт, вы принимаете <Link to="/agreement">пользовательское соглашение</Link> и{' '}
                <Link to="/rules">правила сервиса</Link>.
              </p>
            )}

            {!isLogin && isAwaitingVerification && (
              <div className="auth-actions-row">
                <button
                  type="button"
                  className="auth-link-btn"
                  disabled={loading}
                  onClick={() => {
                    resetMessages();
                    void handleRequestCode();
                  }}
                >
                  Отправить код снова
                </button>
                <button
                  type="button"
                  className="auth-link-btn"
                  disabled={loading}
                  onClick={() => {
                    setIsAwaitingVerification(false);
                    setVerificationCode('');
                    resetMessages();
                  }}
                >
                  Изменить данные
                </button>
              </div>
            )}
          </motion.form>
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default Login;
