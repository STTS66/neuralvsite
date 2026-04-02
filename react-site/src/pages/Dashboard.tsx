import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  Clock,
  FileBox,
  Key,
  Link as LinkIcon,
  RefreshCw,
  Send,
  Upload,
  User,
  XCircle,
} from 'lucide-react';
import { API } from '../api';
import './Dashboard.css';

type OrderItem = {
  id: number | string;
  accountId?: string | null;
  date: string;
  link?: string | null;
  status: string;
  licenseKey?: string | null;
  hasFile?: boolean;
};

const Dashboard: React.FC = () => {
  const [username, setUsername] = useState(localStorage.getItem('neuralv_username') || 'User');
  const [accountId, setAccountId] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState(
    `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=0D8ABC&color=fff`,
  );
  const [orderLink, setOrderLink] = useState('');
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const orderFileInputRef = useRef<HTMLInputElement>(null);
  const currentUserId = localStorage.getItem('neuralv_id');

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    const loadData = async () => {
      const [userOrders, userProfile] = await Promise.all([
        API.getOrders(currentUserId),
        API.getUserProfile(currentUserId),
      ]);

      if (Array.isArray(userOrders)) {
        setOrders(userOrders.reverse());
      }

      if (userProfile) {
        const profileName = userProfile.display_name || userProfile.username;
        setUsername(profileName);
        setAccountId(userProfile.account_id || userProfile.accountId || '');
        if (userProfile.avatar) {
          setAvatar(userProfile.avatar);
        } else {
          setAvatar(
            `https://ui-avatars.com/api/?name=${encodeURIComponent(profileName)}&background=0D8ABC&color=fff`,
          );
        }
      }

      setLoadingOrders(false);
    };

    void loadData();
  }, [currentUserId]);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
  } as const;

  const handleAvatarSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.[0]) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      if (loadEvent.target?.result) {
        setAvatar(loadEvent.target.result.toString());
      }
    };
    reader.readAsDataURL(event.target.files[0]);
  };

  const reloadOrders = async () => {
    if (!currentUserId) {
      return;
    }

    const userOrders = await API.getOrders(currentUserId);
    if (Array.isArray(userOrders)) {
      setOrders(userOrders.reverse());
    }
  };

  const handleSaveProfile = async () => {
    if (!currentUserId) {
      return;
    }

    const res = await API.updateProfile(
      currentUserId,
      username,
      avatar.includes('ui-avatars') ? null : avatar,
      password || undefined,
      oldPassword || undefined,
    );

    if (res?.success) {
      localStorage.setItem('neuralv_username', username);
      setPassword('');
      setOldPassword('');
      alert('Профиль обновлен.');
      return;
    }

    alert(res?.message || 'Ошибка при сохранении профиля.');
  };

  const handleSubmitOrder = async () => {
    if (!orderLink && !orderFileInputRef.current?.files?.length) {
      alert('Введите ссылку или прикрепите файл для проверки.');
      return;
    }

    if (!currentUserId) {
      return;
    }

    const file = orderFileInputRef.current?.files?.[0] || null;
    const res = await API.submitOrder(currentUserId, orderLink, file);

    if (res?.success) {
      alert('Заявка отправлена на проверку.');
      setOrderLink('');
      if (orderFileInputRef.current) {
        orderFileInputRef.current.value = '';
      }
      await reloadOrders();
      return;
    }

    alert(res?.message || 'Ошибка при создании заявки.');
  };

  const getStatusIcon = (status: string) => {
    if (status === 'active') {
      return <CheckCircle size={18} className="text-success" />;
    }
    if (status === 'rejected') {
      return <XCircle size={18} className="text-danger" />;
    }
    return <Clock size={18} className="text-warning" />;
  };

  const getStatusText = (status: string) => {
    if (status === 'active') {
      return 'Одобрено';
    }
    if (status === 'rejected') {
      return 'Отклонено';
    }
    return 'На проверке';
  };

  return (
    <div className="dashboard-container">
      <div className="bg-glow dash-glow" />

      <motion.div
        className="dashboard-content"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <div className="dash-columns">
          <div className="dash-col">
            <motion.div variants={itemVariants} className="glass-panel profile-card">
              <div className="profile-header">
                <div className="avatar-wrapper">
                  <img src={avatar} alt="Avatar" className="profile-avatar" />
                  <button
                    className="edit-avatar-btn"
                    onClick={() => avatarInputRef.current?.click()}
                    type="button"
                  >
                    <RefreshCw size={14} />
                  </button>
                  <input
                    type="file"
                    ref={avatarInputRef}
                    style={{ display: 'none' }}
                    accept="image/*"
                    onChange={handleAvatarSelect}
                  />
                </div>

                <div className="profile-details">
                  <h3 className="profile-name-display">{username}</h3>
                  <p className="profile-email">В системе NeuralV</p>
                  {accountId ? <div className="profile-account-id">Account ID: {accountId}</div> : null}

                  <div className="profile-form-group">
                    <label>Изменить никнейм</label>
                    <div className="profile-input-wrapper">
                      <User size={16} className="profile-input-icon" />
                      <input
                        type="text"
                        className="profile-input"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
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
                        onChange={(event) => setOldPassword(event.target.value)}
                        placeholder="Текущий пароль"
                      />
                    </div>
                    <div className="profile-input-wrapper">
                      <Key size={16} className="profile-input-icon" />
                      <input
                        type="password"
                        className="profile-input"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Новый пароль"
                      />
                    </div>
                  </div>

                  <button
                    className="btn btn-outline btn-sm mt-3"
                    style={{ alignSelf: 'flex-start' }}
                    onClick={handleSaveProfile}
                    type="button"
                  >
                    Сохранить профиль
                  </button>
                </div>
              </div>
            </motion.div>

            <motion.div variants={itemVariants} className="glass-panel order-card">
              <h2 className="card-title">Новая заявка</h2>
              <p className="card-subtitle">
                Вставьте ссылку на проект, пост, архив или прикрепите файл для проверки.
              </p>

              <div className="info-box">
                <strong>Информация о стоимости:</strong>
                <br />
                Первая проверка бесплатна.
                <br />
                Следующие заявки оплачиваются отдельно.
              </div>

              <div className="form-group">
                <div className="input-wrapper">
                  <LinkIcon size={18} className="input-icon" />
                  <input
                    type="text"
                    className="input-base"
                    placeholder="https://t.me/... или ссылка на проект"
                    value={orderLink}
                    onChange={(event) => setOrderLink(event.target.value)}
                  />
                </div>
              </div>

              <div className="form-group mt-3">
                <label className="file-label">
                  <Upload size={16} /> Прикрепить файл для анализа
                  <input type="file" ref={orderFileInputRef} className="file-input" />
                </label>
              </div>

              <button className="btn btn-primary full-btn upload-btn" onClick={handleSubmitOrder} type="button">
                <Send size={18} /> Отправить на проверку
              </button>
            </motion.div>
          </div>

          <div className="dash-col">
            <motion.div variants={itemVariants} className="glass-panel orders-list-card">
              <div className="card-header-flex">
                <h2 className="card-title m-0">Мои проверки</h2>
                <div className="orders-count">{orders.length}</div>
              </div>

              <div className="orders-list">
                {loadingOrders ? (
                  <p className="text-muted text-center pt-4">Загрузка заявок...</p>
                ) : orders.length === 0 ? (
                  <p className="text-muted text-center pt-4">У вас пока нет активных заявок.</p>
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
                          <div className="order-title">
                            Заявка #{orders.length - idx}
                            <span className="order-id">(ID: {order.id})</span>
                          </div>
                          <div className="order-date">{order.date}</div>
                        </div>

                        <div className={`status-badge status-${order.status}`}>
                          {getStatusIcon(order.status)}
                          {getStatusText(order.status)}
                        </div>
                      </div>

                      <div className="order-link-display">
                        <FileBox size={16} />
                        {order.link || 'Файл прикреплен'}
                      </div>

                      {order.licenseKey ? (
                        <div className="profile-account-id">Лицензия: {order.licenseKey}</div>
                      ) : null}

                      {order.status === 'rejected' ? (
                        <div className="order-error">
                          Проверка не пройдена. Если результат непонятен, напишите в поддержку через сайт.
                        </div>
                      ) : null}
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
