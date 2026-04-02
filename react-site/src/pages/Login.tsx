import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Shield, Key, User, ArrowRight, Mail } from 'lucide-react';
import { API } from '../api';
import './Login.css';

const Login: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    if (isLogin) {
      const res = await API.loginUser(username, password);
      if (res.success) {
        localStorage.setItem('neuralv_id', res.user.id);
        localStorage.setItem('neuralv_username', res.user.username);
        localStorage.setItem('neuralv_role', res.user.role);
        navigate('/');
        window.location.reload();
      } else {
        setErrorMsg(res.message || 'Ошибка входа');
      }
    } else {
      if (password !== confirmPassword) {
        setErrorMsg('Пароли не совпадают!');
        setLoading(false);
        return;
      }
      const res = await API.registerUser(username, email, password);
      if (res.success) {
        alert('Регистрация успешна! Теперь вы можете войти.');
        setIsLogin(true);
        setPassword('');
        setConfirmPassword('');
      } else {
        setErrorMsg(res.message || 'Ошибка регистрации');
      }
    }
    setLoading(false);
  };

  const formVariants = {
    hidden: { opacity: 0, x: isLogin ? -30 : 30 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: "easeOut" } },
    exit: { opacity: 0, x: isLogin ? 30 : -30, transition: { duration: 0.3 } }
  } as any;

  return (
    <div className="auth-container">
      <div className="bg-glow auth-glow"></div>
      
      <motion.div 
        className="auth-card glass-panel"
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, type: "spring", bounce: 0.4 }}
      >
        <div className="auth-header">
          <motion.div 
            className="auth-icon"
            animate={{ rotate: isLogin ? 0 : 360 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
          >
            <Shield size={40} />
          </motion.div>
          <h2 className="gradient-text">{isLogin ? 'Вход в систему' : 'Регистрация'}</h2>
          <p className="auth-subtitle">
            {isLogin ? 'Получите доступ к управлению защитой' : 'Создайте новый аккаунт для защиты устройств'}
          </p>
        </div>

        <div className="auth-toggle">
          <button 
            className={`toggle-btn ${isLogin ? 'active' : ''}`}
            onClick={() => { setIsLogin(true); setErrorMsg(''); }}
            type="button"
          >
            Войти
          </button>
          <button 
            className={`toggle-btn ${!isLogin ? 'active' : ''}`}
            onClick={() => { setIsLogin(false); setErrorMsg(''); }}
            type="button"
          >
            Регистрация
          </button>
        </div>

        {errorMsg && <div className="text-danger mb-3" style={{textAlign: 'center'}}>{errorMsg}</div>}

        <AnimatePresence mode="wait">
          <motion.form 
            key={isLogin ? 'login' : 'register'}
            variants={formVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="auth-form"
            onSubmit={handleSubmit}
          >
            <div className="input-group">
              <label>Имя пользователя</label>
              <div className="input-wrapper">
                <User size={18} className="input-icon" />
                <input 
                  type="text" 
                  className="input-base" 
                  placeholder="Введите логин" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required 
                />
              </div>
            </div>

            {!isLogin && (
              <motion.div className="input-group" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                <label>Email</label>
                <div className="input-wrapper">
                  <Mail size={18} className="input-icon" />
                  <input 
                    type="email" 
                    className="input-base" 
                    placeholder="Введите email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required 
                  />
                </div>
              </motion.div>
            )}

            <div className="input-group">
              <label>Пароль</label>
              <div className="input-wrapper">
                <Key size={18} className="input-icon" />
                <input 
                  type="password" 
                  className="input-base" 
                  placeholder="Введите пароль" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                />
              </div>
            </div>

            {!isLogin && (
              <motion.div 
                className="input-group"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
              >
                <label>Повторите пароль</label>
                <div className="input-wrapper">
                  <Key size={18} className="input-icon" />
                  <input 
                    type="password" 
                    className="input-base" 
                    placeholder="Повторите пароль" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required 
                  />
                </div>
              </motion.div>
            )}

            <button type="submit" className="btn btn-primary submit-btn" disabled={loading}>
              {loading ? 'Обработка...' : isLogin ? 'Войти' : 'Создать аккаунт'}
              {!loading && <ArrowRight size={18} />}
            </button>
          </motion.form>
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default Login;
