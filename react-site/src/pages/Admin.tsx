import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, FileBox, Key, RefreshCw, Search, ShieldBan, Trash, User, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { API } from '../api';
import type { AdminUserSearchResponse } from '../api';
import './Dashboard.css';
import './Admin.css';

type OrderItem = {
  id: number | string;
  user_id: number;
  accountId?: string | null;
  username: string;
  date: string;
  link?: string | null;
  status: string;
  licenseKey?: string | null;
  hasFile?: boolean;
};

type UsersListItem = {
  id: number;
  account_id?: string | null;
  username: string;
  email: string;
  role: string;
  order_count?: number;
  banned_until?: string | null;
};

const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'orders' | 'users' | 'profile'>('orders');
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [usersList, setUsersList] = useState<UsersListItem[]>([]);
  const [vtStatus, setVtStatus] = useState<Record<string, string>>({});
  const [loadingVt, setLoadingVt] = useState<Record<string, boolean>>({});
  const [searchParams, setSearchParams] = useSearchParams();
  const [accountSearch, setAccountSearch] = useState(searchParams.get('accountId') || '');
  const [selectedUser, setSelectedUser] = useState<AdminUserSearchResponse | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [banHours, setBanHours] = useState('24');
  const [banReason, setBanReason] = useState('Нарушение правил сервиса');

  const currentUserId = localStorage.getItem('neuralv_id');
  const [username, setUsername] = useState(localStorage.getItem('neuralv_username') || 'Admin');
  const [accountId, setAccountId] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState(
    `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=0D8ABC&color=fff`,
  );
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const loadAdminData = async () => {
    const [dbOrders, dbUsers] = await Promise.all([API.getOrders(), API.getUsers()]);

    if (Array.isArray(dbOrders)) {
      setOrders(dbOrders.reverse());
    }

    if (Array.isArray(dbUsers)) {
      setUsersList(dbUsers);
    }

    if (currentUserId) {
      const userProfile = await API.getUserProfile(currentUserId);
      if (userProfile) {
        const profileName = userProfile.display_name || userProfile.username;
        setUsername(profileName);
        setAccountId(userProfile.account_id || userProfile.accountId || '');
        if (userProfile.avatar) {
          setAvatar(userProfile.avatar);
        }
      }
    }
  };

  const handleSearchUser = async (rawAccountId?: string) => {
    const target = (rawAccountId ?? accountSearch).trim().toUpperCase();
    if (!target) {
      return;
    }

    setSearchLoading(true);
    const response = await API.searchAdminUserByAccountId(target);
    setSearchLoading(false);

    if (!response.success) {
      setSelectedUser(response);
      alert(response.message || 'Пользователь не найден.');
      return;
    }

    setSelectedUser(response);
    setAccountSearch(target);
    setActiveTab('users');
    setSearchParams({ accountId: target });
  };

  useEffect(() => {
    void loadAdminData();
  }, [currentUserId]);

  useEffect(() => {
    const target = searchParams.get('accountId');
    if (target) {
      setAccountSearch(target);
      setActiveTab('users');
      void handleSearchUser(target);
    }
  }, []);

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

  const handleUpdateStatus = async (id: string | number, status: string) => {
    if (!window.confirm(`Установить статус "${status}" для заявки?`)) {
      return;
    }

    const res = await API.updateStatus(String(id), status);
    if (res?.success) {
      setOrders((current) =>
        current.map((order) => (String(order.id) === String(id) ? { ...order, status } : order)),
      );
      if (selectedUser?.success && selectedUser.user?.accountId) {
        await handleSearchUser(selectedUser.user.accountId);
      }
      return;
    }

    alert('Ошибка при обновлении статуса.');
  };

  const handleDeleteOrder = async (id: string | number) => {
    if (!window.confirm('Удалить эту заявку?')) {
      return;
    }

    const res = await API.deleteOrder(String(id));
    if (res?.success) {
      setOrders((current) => current.filter((order) => String(order.id) !== String(id)));
      if (selectedUser?.success && selectedUser.user?.accountId) {
        await handleSearchUser(selectedUser.user.accountId);
      }
      return;
    }

    alert(`Ошибка при удалении: ${res?.message || ''}`);
  };

  const handleVtScan = async (id: string | number) => {
    const key = String(id);
    setLoadingVt((current) => ({ ...current, [key]: true }));
    setVtStatus((current) => ({ ...current, [key]: 'Отправка в VirusTotal...' }));

    const scanRes = await API.scanVirusTotal(key);
    if (!scanRes?.success) {
      setVtStatus((current) => ({ ...current, [key]: 'Ошибка сканирования' }));
      setLoadingVt((current) => ({ ...current, [key]: false }));
      return;
    }

    setVtStatus((current) => ({ ...current, [key]: 'Файл проверяется...' }));

    const pollVT = async () => {
      const reportData = await API.getVirusTotalReport(scanRes.analysisId);
      if (reportData.data?.attributes?.status === 'completed') {
        const malicious = Number(reportData.data.attributes.stats?.malicious || 0);
        setVtStatus((current) => ({
          ...current,
          [key]: malicious > 0 ? `Опасно: ${malicious} детектов` : 'Чисто: 0 детектов',
        }));
        setLoadingVt((current) => ({ ...current, [key]: false }));
        return;
      }

      if (reportData.error) {
        setVtStatus((current) => ({ ...current, [key]: 'Ошибка VT API' }));
        setLoadingVt((current) => ({ ...current, [key]: false }));
        return;
      }

      setTimeout(() => {
        void pollVT();
      }, 3000);
    };

    await pollVT();
  };

  const handleBanUser = async () => {
    const target = selectedUser?.user?.accountId;
    if (!target) {
      return;
    }

    const duration = Number(banHours);
    if (!Number.isFinite(duration) || duration <= 0) {
      alert('Укажи количество часов для бана.');
      return;
    }

    const res = await API.banUserByAccountId(target, duration, banReason);
    if (!res?.success) {
      alert(res?.message || 'Не удалось выдать бан.');
      return;
    }

    await loadAdminData();
    await handleSearchUser(target);
  };

  const handleUnbanUser = async () => {
    const target = selectedUser?.user?.accountId;
    if (!target) {
      return;
    }

    const res = await API.unbanUserByAccountId(target);
    if (!res?.success) {
      alert(res?.message || 'Не удалось снять бан.');
      return;
    }

    await loadAdminData();
    await handleSearchUser(target);
  };

  const formatBanLabel = (value?: string | null) => {
    if (!value) {
      return 'Нет';
    }
    return new Date(value).toLocaleString('ru-RU');
  };

  return (
    <div className="dashboard-container">
      <div className="bg-glow dash-glow" />

      <motion.div className="dashboard-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="admin-header glass-panel">
          <div className="admin-title-flex">
            <h2>Админ-панель NeuralV</h2>
            <p className="card-subtitle">Заявки, пользователи, account ID и управление блокировками.</p>
          </div>

          <div className="admin-tabs">
            <button
              className={`admin-tab ${activeTab === 'orders' ? 'active' : ''}`}
              onClick={() => setActiveTab('orders')}
              type="button"
            >
              Заявки
            </button>
            <button
              className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
              type="button"
            >
              Пользователи
            </button>
            <button
              className={`admin-tab ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
              type="button"
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
              <h3 className="section-title">Список заявок на проверку</h3>
              <div className="orders-list list-full">
                {orders.length === 0 ? (
                  <p className="text-muted text-center pt-4">Заявок пока нет.</p>
                ) : (
                  orders.map((order, idx) => (
                    <div key={order.id} className="order-item admin-order-item">
                      <div className="order-details-left">
                        <div className="order-title">
                          Заявка #{orders.length - idx}
                          <span className="order-id">(ID: {order.id})</span>
                        </div>
                        <div className="admin-inline-meta">
                          Пользователь: <strong>{order.username}</strong>
                          {order.accountId ? <span>Account ID: {order.accountId}</span> : null}
                        </div>
                        <div className="order-link-display">
                          <FileBox size={16} />
                          {order.link || 'Файл прикреплен'}
                        </div>
                        <div className="order-date mt-2">{order.date}</div>
                        {order.licenseKey ? (
                          <div className="text-success mt-1" style={{ fontSize: '0.85rem' }}>
                            Лицензия: {order.licenseKey}
                          </div>
                        ) : null}
                      </div>

                      <div className="order-actions-right">
                        <div className="actions-flex">
                          {order.accountId ? (
                            <button
                              className="btn btn-sm btn-outline"
                              onClick={() => void handleSearchUser(order.accountId || '')}
                              type="button"
                            >
                              Профиль
                            </button>
                          ) : null}

                          {order.status === 'pending' ? (
                            <>
                              {order.hasFile ? (
                                <button
                                  className="btn btn-sm btn-vt"
                                  onClick={() => void handleVtScan(order.id)}
                                  disabled={loadingVt[String(order.id)]}
                                  type="button"
                                >
                                  {loadingVt[String(order.id)] ? (
                                    <RefreshCw className="spin" size={14} />
                                  ) : (
                                    'VT Scan'
                                  )}
                                </button>
                              ) : null}
                              <button
                                className="btn btn-sm btn-approve"
                                onClick={() => void handleUpdateStatus(order.id, 'active')}
                                type="button"
                              >
                                <Check size={14} /> Чисто
                              </button>
                              <button
                                className="btn btn-sm btn-reject"
                                onClick={() => void handleUpdateStatus(order.id, 'rejected')}
                                type="button"
                              >
                                <X size={14} /> Вирус
                              </button>
                            </>
                          ) : null}

                          <span className={`status-badge status-${order.status}`}>
                            {order.status === 'pending'
                              ? 'На проверке'
                              : order.status === 'active'
                                ? 'Одобрено'
                                : 'Отклонено'}
                          </span>

                          <button
                            className="btn btn-sm btn-outline btn-trash"
                            onClick={() => void handleDeleteOrder(order.id)}
                            type="button"
                          >
                            <Trash size={14} />
                          </button>
                        </div>

                        {vtStatus[String(order.id)] ? (
                          <div
                            className={`vt-result ${
                              vtStatus[String(order.id)].toLowerCase().includes('опасно') ? 'danger' : 'success'
                            }`}
                          >
                            {vtStatus[String(order.id)]}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
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
                  <p className="text-muted m-0">Всего пользователей</p>
                  <h3 className="m-0 mt-1">{usersList.length}</h3>
                </div>
                <div className="stat-box">
                  <p className="text-muted m-0">Всего заявок</p>
                  <h3 className="m-0 mt-1">{orders.length}</h3>
                </div>
              </div>

              <div className="admin-search-box">
                <div className="profile-input-wrapper admin-search-input">
                  <Search size={16} className="profile-input-icon" />
                  <input
                    type="text"
                    className="profile-input"
                    value={accountSearch}
                    onChange={(event) => setAccountSearch(event.target.value.toUpperCase())}
                    placeholder="Введи account ID, например NV-AB12CD34"
                  />
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => void handleSearchUser()}
                  disabled={searchLoading}
                  type="button"
                >
                  {searchLoading ? 'Поиск...' : 'Открыть профиль'}
                </button>
              </div>

              {selectedUser?.success && selectedUser.user && selectedUser.stats ? (
                <div className="admin-user-profile glass-panel">
                  <div className="admin-user-head">
                    <div>
                      <h3>{selectedUser.user.displayName || selectedUser.user.username}</h3>
                      <div className="admin-inline-meta">
                        <span>Account ID: {selectedUser.user.accountId}</span>
                        <span>Email: {selectedUser.user.email}</span>
                        <span>Роль: {selectedUser.user.role}</span>
                      </div>
                    </div>
                    <span className={`role-badge ${selectedUser.user.isBanned ? 'admin' : 'user'}`}>
                      {selectedUser.user.isBanned ? 'Забанен' : 'Активен'}
                    </span>
                  </div>

                  <div className="admin-user-stats-grid">
                    <div className="stat-box">
                      <p className="text-muted m-0">Всего проверок</p>
                      <h3 className="m-0 mt-1">{selectedUser.stats.totalOrders}</h3>
                    </div>
                    <div className="stat-box">
                      <p className="text-muted m-0">На проверке</p>
                      <h3 className="m-0 mt-1">{selectedUser.stats.pendingOrders}</h3>
                    </div>
                    <div className="stat-box">
                      <p className="text-muted m-0">Одобрено</p>
                      <h3 className="m-0 mt-1">{selectedUser.stats.approvedOrders}</h3>
                    </div>
                    <div className="stat-box">
                      <p className="text-muted m-0">Отклонено</p>
                      <h3 className="m-0 mt-1">{selectedUser.stats.rejectedOrders}</h3>
                    </div>
                  </div>

                  <div className="admin-inline-meta admin-user-secondary-meta">
                    <span>Диалоги поддержки: {selectedUser.stats.supportConversations}</span>
                    <span>Последняя заявка: {selectedUser.stats.lastOrderAt || 'нет данных'}</span>
                    <span>Бан до: {formatBanLabel(selectedUser.user.bannedUntil)}</span>
                  </div>

                  <div className="admin-ban-box">
                    <div className="admin-ban-header">
                      <ShieldBan size={18} />
                      <strong>Блокировка пользователя</strong>
                    </div>
                    <div className="admin-ban-controls">
                      <div className="profile-input-wrapper admin-ban-hours">
                        <input
                          type="number"
                          className="profile-input"
                          min="1"
                          value={banHours}
                          onChange={(event) => setBanHours(event.target.value)}
                          placeholder="Часы"
                        />
                      </div>
                      <div className="profile-input-wrapper admin-ban-reason">
                        <input
                          type="text"
                          className="profile-input"
                          value={banReason}
                          onChange={(event) => setBanReason(event.target.value)}
                          placeholder="Причина бана"
                        />
                      </div>
                      <button className="btn btn-sm btn-reject" onClick={handleBanUser} type="button">
                        Выдать бан
                      </button>
                      <button className="btn btn-sm btn-approve" onClick={handleUnbanUser} type="button">
                        Снять бан
                      </button>
                    </div>
                    {selectedUser.user.banReason ? (
                      <p className="text-muted m-0">Текущая причина: {selectedUser.user.banReason}</p>
                    ) : null}
                  </div>

                  <div className="admin-recent-orders">
                    <h4>Последние заявки</h4>
                    {selectedUser.recentOrders?.length ? (
                      selectedUser.recentOrders.map((order) => (
                        <div key={order.id} className="order-item compact-order-item">
                          <div className="order-title">
                            Заявка #{order.id}
                            <span className="order-id">({order.status})</span>
                          </div>
                          <div className="order-link-display">
                            <FileBox size={16} />
                            {order.link || 'Файл прикреплен'}
                          </div>
                          <div className="order-date">{order.createdAt}</div>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted">У пользователя еще нет заявок.</p>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="table-responsive">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Account ID</th>
                      <th>Имя</th>
                      <th>Email</th>
                      <th>Проверок</th>
                      <th>Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.map((user) => (
                      <tr key={user.id}>
                        <td>{user.id}</td>
                        <td>
                          <button
                            className="table-link-button"
                            onClick={() => void handleSearchUser(user.account_id || '')}
                            type="button"
                          >
                            {user.account_id || '—'}
                          </button>
                        </td>
                        <td className="fw-bold">{user.username}</td>
                        <td className="text-muted">{user.email}</td>
                        <td>{user.order_count || 0}</td>
                        <td>
                          <span className={`role-badge ${user.banned_until ? 'admin' : 'user'}`}>
                            {user.banned_until ? 'Бан' : user.role}
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
                  <p className="profile-email">Администратор NeuralV</p>
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
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default Admin;
