import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, Upload, FileBox, RefreshCw, Send, CheckCircle, XCircle, Clock, User, Key } from 'lucide-react';
import { API } from '../api';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const [username, setUsername] = useState(localStorage.getItem('neuralv_username') || 'User');
  const [oldPassword, setOldPassword] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState(`https://ui-avatars.com/api/?name=${username}&background=0D8ABC&color=fff`);
  const [orderLink, setOrderLink] = useState('');
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const currentUserId = localStorage.getItem('neuralv_id');

  useEffect(() => {
    if (!currentUserId) return;
    
    const loadData = async () => {
      // Load orders
      const userOrders = await API.getOrders(currentUserId);
      if (Array.isArray(userOrders)) setOrders(userOrders.reverse());
      setLoadingOrders(false);

      // Load profile
      const userProfile = await API.getUserProfile(currentUserId);
      if (userProfile) {
        setUsername(userProfile.display_name || userProfile.username);
        if (userProfile.avatar) {
          setAvatar(userProfile.avatar);
        }
      }
    };
    loadData();
  }, [currentUserId]);

  const containerVariants: any = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants: any = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setAvatar(event.target.result.toString());
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleSaveProfile = async () => {
    if (!currentUserId) return;
    const res = await API.updateProfile(
      currentUserId, 
      username, 
      avatar.includes('ui-avatars') ? null : avatar, 
      password || undefined,
      oldPassword || undefined
    );
    if (res && res.success) {
      localStorage.setItem('neuralv_username', username);
      setPassword('');
      setOldPassword('');
      alert('Профиль обновлен!');
    } else {
      alert(res?.message || 'Ошибка при сохранении профиля');
    }
  };

  const handleSubmitOrder = async () => {
    if (!orderLink && (!fileInputRef.current?.files || fileInputRef.current.files.length === 0)) {
      alert("Пожалуйста, введите ссылку или выберите файл!");
      return;
    }
    if (!currentUserId) return;
    
    const file = fileInputRef.current?.files?.[0] || null;
    const res = await API.submitOrder(currentUserId, orderLink, file);
    
    if (res && res.success) {
      alert('Заказ успешно создан!');
      setOrderLink('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      const newOrders = await API.getOrders(currentUserId);
      if (Array.isArray(newOrders)) setOrders(newOrders.reverse());
    } else {
      alert('Ошибка при создании заказа: ' + (res?.message || 'Сервей недоступен.'));
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === 'active') return <CheckCircle size={18} className="text-success" />;
    if (status === 'rejected') return <XCircle size={18} className="text-danger" />;
    return <Clock size={18} className="text-warning" />;
  };

  const getStatusText = (status: string) => {
    if (status === 'active') return 'Одобрено';
    if (status === 'rejected') return 'Отклонено';
    return 'На проверке';
  };

  return (
    <div className="dashboard-container">
      <div className="bg-glow dash-glow"></div>
      
      <motion.div 
        className="dashboard-content"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <div className="dash-columns">
          {/* Left Column - Profile & New Order */}
          <div className="dash-col">
            <motion.div variants={itemVariants} className="glass-panel profile-card">
              <div className="profile-header">
                <div className="avatar-wrapper">
                  <img src={avatar} alt="Avatar" className="profile-avatar" />
                  <button className="edit-avatar-btn" onClick={() => fileInputRef.current?.click()}>
                    <RefreshCw size={14} />
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    accept="image/*"
                    onChange={handleAvatarSelect}
                  />
                </div>
                <div className="profile-details">
                  <h3 className="profile-name-display">{localStorage.getItem('neuralv_username') || 'User'}</h3>
                  <p className="profile-email">В системе NeuralV</p>

                  <div className="profile-form-group">
                    <label>Изменить никнейм</label>
                    <div className="profile-input-wrapper">
                      <User size={16} className="profile-input-icon" />
                      <input 
                        type="text" 
                        className="profile-input" 
                        value={username} 
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Новый никнейм"
                      />
                    </div>
                  </div>

                  <div className="profile-form-group">
                    <label>Изменить пароль</label>
                    <div className="profile-input-wrapper mb-2">
                      <Key size={16} className="profile-input-icon" />
                      <input 
                        type="password" 
                        className="profile-input" 
                        value={oldPassword} 
                        onChange={(e) => setOldPassword(e.target.value)}
                        placeholder="Старый пароль"
                      />
                    </div>
                    <div className="profile-input-wrapper">
                      <Key size={16} className="profile-input-icon" />
                      <input 
                        type="password" 
                        className="profile-input" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Новый пароль"
                      />
                    </div>
                  </div>

                  <button className="btn btn-outline btn-sm mt-3" style={{ alignSelf: 'flex-start' }} onClick={handleSaveProfile}>
                    Сохранить профиль
                  </button>
                </div>
              </div>
            </motion.div>

            <motion.div variants={itemVariants} className="glass-panel order-card">
              <h2 className="card-title">Новый Заказ</h2>
              <p className="card-subtitle">Вставьте ссылку на ваш проект или сообщение в Telegram для анализа.</p>
              
              <div className="info-box">
                <strong>ℹ️ Информация о стоимости:</strong><br />
                Первая проверка — <strong>Бесплатно</strong>.<br />
                Далее — <strong>390 ₽</strong> за проект.
              </div>

              <div className="form-group">
                <div className="input-wrapper">
                  <Link size={18} className="input-icon" />
                  <input 
                    type="text" 
                    className="input-base" 
                    placeholder="https://t.me/..."
                    value={orderLink}
                    onChange={(e) => setOrderLink(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group mt-3">
                <label className="file-label">
                  <Upload size={16} /> Прикрепить файл (exe, zip, rar, py)
                  <input type="file" ref={fileInputRef} className="file-input" />
                </label>
              </div>

              <button className="btn btn-primary full-btn upload-btn" onClick={handleSubmitOrder}>
                <Send size={18} /> Отправить на проверку
              </button>
            </motion.div>
          </div>

          {/* Right Column - Orders List */}
          <div className="dash-col">
            <motion.div variants={itemVariants} className="glass-panel orders-list-card">
              <div className="card-header-flex">
                <h2 className="card-title m-0">Мои Заказы</h2>
                <div className="orders-count">{orders.length}</div>
              </div>
              
              <div className="orders-list">
                {loadingOrders ? (
                  <p className="text-muted text-center pt-4">Загрузка заказов...</p>
                ) : orders.length === 0 ? (
                  <p className="text-muted text-center pt-4">У вас пока нет активных заказов.</p>
                ) : (
                  orders.map((order, idx) => (
                    <motion.div 
                      key={order.id} 
                      className="order-item"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                    >
                      <div className="order-header">
                        <div>
                          <div className="order-title">Заказ #{orders.length - idx} <span className="order-id">(ID: {order.id})</span></div>
                          <div className="order-date">{order.date}</div>
                        </div>
                        <div className={`status-badge status-${order.status}`}>
                          {getStatusIcon(order.status)}
                          {getStatusText(order.status)}
                        </div>
                      </div>
                      <div className="order-link-display">
                        <FileBox size={16} /> {order.link || 'Файл прикреплен'}
                      </div>
                      {order.status === 'rejected' && (
                        <div className="order-error">Ваш проект не прошел проверку. Свяжитесь с поддержкой.</div>
                      )}
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;
