import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileBox, Trash, Check, X, RefreshCw, User, Key } from 'lucide-react';
import { API } from '../api';
import './Dashboard.css';
import './Admin.css';

const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'orders' | 'users' | 'profile'>('orders');

  const [orders, setOrders] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [vtStatus, setVtStatus] = useState<Record<string, string>>({});
  const [loadingVt, setLoadingVt] = useState<Record<string, boolean>>({});

  const currentUserId = localStorage.getItem('neuralv_id');
  const [username, setUsername] = useState(localStorage.getItem('neuralv_username') || 'Admin');
  const [oldPassword, setOldPassword] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState(`https://ui-avatars.com/api/?name=${username}&background=0D8ABC&color=fff`);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchAdminData = async () => {
      const dbOrders = await API.getOrders();
      if (Array.isArray(dbOrders)) setOrders(dbOrders.reverse());
      
      const dbUsers = await API.getUsers();
      if (Array.isArray(dbUsers)) setUsersList(dbUsers);

      if (currentUserId) {
        const userProfile = await API.getUserProfile(currentUserId);
        if (userProfile) {
          setUsername(userProfile.display_name || userProfile.username);
          if (userProfile.avatar) setAvatar(userProfile.avatar);
        }
      }
    };
    fetchAdminData();
  }, [currentUserId]);

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) setAvatar(event.target.result.toString());
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

  const handleUpdateStatus = async (id: string, status: string) => {
    if (window.confirm(`Вы уверены, что хотите установить статус: ${status}?`)) {
      const res = await API.updateStatus(id, status);
      if (res && res.success) {
        setOrders(orders.map(o => o.id === id ? { ...o, status } : o));
      } else {
        alert("Ошибка при обновлении статуса");
      }
    }
  };

  const handleDeleteOrder = async (id: string) => {
    if (window.confirm("Удалить этот заказ?")) {
      const res = await API.deleteOrder(id);
      if (res && res.success) {
        setOrders(orders.filter(o => o.id !== id));
      } else {
        alert("Ошибка при удалении: " + (res.message || ''));
      }
    }
  };

  const handleVtScan = async (id: string) => {
    setLoadingVt(prev => ({ ...prev, [id]: true }));
    setVtStatus(prev => ({ ...prev, [id]: 'Отправка в VirusTotal...' }));

    const scanRes = await API.scanVirusTotal(id);
    if (!scanRes || !scanRes.success) {
       setVtStatus(prev => ({ ...prev, [id]: 'Ошибка сканирования' }));
       setLoadingVt(prev => ({ ...prev, [id]: false }));
       return;
    }

    setVtStatus(prev => ({ ...prev, [id]: 'Сканирование файла...' }));
    
    // Poll VT
    const pollVT = async () => {
       const reportData = await API.getVirusTotalReport(scanRes.analysisId);
       if (reportData.data && reportData.data.attributes.status === 'completed') {
           const stats = reportData.data.attributes.stats;
           const malicious = stats.malicious;
           if (malicious > 0) {
              setVtStatus(prev => ({ ...prev, [id]: `ОПАСНО: ${malicious} угроз!` }));
           } else {
              setVtStatus(prev => ({ ...prev, [id]: 'ЧИСТО (0)' }));
           }
           setLoadingVt(prev => ({ ...prev, [id]: false }));
       } else if (reportData.error) {
           setVtStatus(prev => ({ ...prev, [id]: 'Ошибка VT API' }));
           setLoadingVt(prev => ({ ...prev, [id]: false }));
       } else {
           setTimeout(pollVT, 3000);
       }
    };
    pollVT();
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  return (
    <div className="dashboard-container">
      <div className="bg-glow dash-glow"></div>
      
      <motion.div className="dashboard-content" variants={containerVariants} initial="hidden" animate="show">
        <div className="admin-header glass-panel">
          <div className="admin-title-flex">
            <h2>Управление Заказами</h2>
          </div>
          
          <div className="admin-tabs">
            <button 
              className={`admin-tab ${activeTab === 'orders' ? 'active' : ''}`}
              onClick={() => setActiveTab('orders')}
            >
              Заказы
            </button>
            <button 
              className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              Пользователи
            </button>
            <button 
              className={`admin-tab ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              Профиль
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'orders' ? (
            <motion.div 
              key="orders"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="glass-panel admin-panel"
            >
              <h3 className="section-title">Список заказов на аудит</h3>
              <div className="orders-list list-full">
                {orders.length === 0 && <p className="text-muted text-center pt-4">Нет заказов</p>}
                {orders.map((order, idx) => (
                  <div key={order.id} className="order-item admin-order-item">
                    <div className="order-details-left">
                      <div className="order-title">
                        Заказ #{orders.length - idx} <span className="order-id">(ID: {order.id})</span>
                      </div>
                      <div className="text-muted" style={{fontSize:'0.85rem', marginBottom:'8px'}}>
                        Пользователь: <strong style={{color:'#fff'}}>{order.username} (ID: {order.user_id})</strong>
                      </div>
                      <div className="order-link-display">
                        <FileBox size={16} /> {order.link || 'Файл'}
                      </div>
                      <div className="order-date mt-2">{order.date}</div>
                      {order.licenseKey && <div className="text-success mt-1" style={{fontSize:'0.85rem'}}>Лицензия: {order.licenseKey}</div>}
                    </div>

                    <div className="order-actions-right">
                      <div className="actions-flex">
                        {order.status === 'pending' && (
                          <>
                            {order.hasFile && (
                              <button 
                                className="btn btn-sm btn-vt" 
                                onClick={() => handleVtScan(order.id)}
                                disabled={loadingVt[order.id]}
                              >
                                {loadingVt[order.id] ? <RefreshCw className="spin" size={14}/> : '🔍 VT Scan'}
                              </button>
                            )}
                            <button className="btn btn-sm btn-approve" onClick={() => handleUpdateStatus(order.id, 'active')}>
                              <Check size={14} /> Чисто
                            </button>
                            <button className="btn btn-sm btn-reject" onClick={() => handleUpdateStatus(order.id, 'rejected')}>
                              <X size={14} /> Вирус
                            </button>
                          </>
                        )}
                        <span className={`status-badge status-${order.status}`}>
                          {order.status === 'pending' ? 'На проверке' : order.status === 'active' ? 'Одобрено' : 'Отклонено'}
                        </span>
                        <button className="btn btn-sm btn-outline btn-trash" onClick={() => handleDeleteOrder(order.id)}>
                          <Trash size={14} />
                        </button>
                      </div>
                      
                      {vtStatus[order.id] && (
                        <div className={`vt-result ${vtStatus[order.id].includes('ОПАСНО') ? 'danger' : 'success'}`}>
                          {vtStatus[order.id]}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : activeTab === 'users' ? (
            <motion.div 
              key="users"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="glass-panel admin-panel"
            >
              <div className="users-stats mb-4">
                <div className="stat-box">
                  <p className="text-muted m-0">Всего пользователей:</p>
                  <h3 className="m-0 mt-1">{usersList.length}</h3>
                </div>
                <div className="stat-box">
                  <p className="text-muted m-0">Всего заказов:</p>
                  <h3 className="m-0 mt-1">{orders.length}</h3>
                </div>
              </div>

              <div className="table-responsive">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Имя</th>
                      <th>Email</th>
                      <th>Роль</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.map((u) => (
                      <tr key={u.id}>
                        <td>{u.id}</td>
                        <td className="fw-bold">{u.username}</td>
                        <td className="text-muted">{u.email}</td>
                        <td>
                          <span className={`role-badge ${u.role}`}>
                            {u.role}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="profile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="glass-panel profile-card"
            >
              <h3 className="section-title">Профиль администратора</h3>
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
                  <h3 className="profile-name-display">{localStorage.getItem('neuralv_username') || 'Admin'}</h3>
                  <p className="profile-email">Администратор NeuralV</p>

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
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default Admin;
