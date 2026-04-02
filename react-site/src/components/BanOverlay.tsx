import { ShieldAlert } from 'lucide-react';
import './BanOverlay.css';

interface BanOverlayProps {
  message: string;
  bannedUntil?: string | null;
  banReason?: string | null;
  onLogout: () => void;
}

function formatBanDate(value?: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date);
}

const BanOverlay: React.FC<BanOverlayProps> = ({
  message,
  bannedUntil,
  banReason,
  onLogout,
}) => {
  const formattedDate = formatBanDate(bannedUntil);

  return (
    <div className="ban-overlay" role="alertdialog" aria-modal="true" aria-labelledby="ban-overlay-title">
      <div className="ban-card">
        <div className="ban-icon-shell">
          <ShieldAlert size={28} />
        </div>

        <h2 id="ban-overlay-title">Аккаунт временно заблокирован</h2>
        <p className="ban-message">
          {message || 'Доступ к функциям сайта временно ограничен администрацией.'}
        </p>

        <div className="ban-details">
          <div className="ban-detail-item">
            <span>Статус</span>
            <strong>Блокировка активна</strong>
          </div>
          <div className="ban-detail-item">
            <span>До</span>
            <strong>{formattedDate || 'До решения администрации'}</strong>
          </div>
          <div className="ban-detail-item">
            <span>Причина</span>
            <strong>{banReason || 'Причина не указана.'}</strong>
          </div>
        </div>

        <p className="ban-note">
          На время блокировки недоступны заявки, поддержка и изменение профиля.
        </p>

        <button type="button" className="ban-logout-button" onClick={onLogout}>
          Выйти из аккаунта
        </button>
      </div>
    </div>
  );
};

export default BanOverlay;
