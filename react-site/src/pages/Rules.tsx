import React from 'react';
import { Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import './Legal.css';

const Rules: React.FC = () => {
  return (
    <div className="legal-page">
      <div className="legal-shell">
        <section className="legal-hero glass-panel">
          <div className="legal-badge">
            <Shield size={16} />
            <span>Правила сервиса</span>
          </div>
          <h1 className="gradient-text legal-title">Правила использования NeuralV</h1>
          <p className="legal-updated">Актуально на 2 апреля 2026 года.</p>
          <p className="legal-intro">
            Эти правила описывают, как пользоваться платформой NeuralV корректно и безопасно. Они
            помогают защитить сервис, пользователей и команду поддержки от злоупотреблений.
          </p>
        </section>

        <section className="legal-section glass-panel">
          <h2>1. Что можно отправлять на проверку</h2>
          <ul className="legal-list">
            <li>Файлы, архивы, APK, скрипты, сборки и проекты, к которым у вас есть законный доступ.</li>
            <li>Материалы для личной проверки безопасности, аудита или оценки риска перед запуском.</li>
            <li>Ссылки на проекты, облачные файлы и Telegram-материалы, если они доступны для анализа.</li>
          </ul>
        </section>

        <section className="legal-section glass-panel">
          <h2>2. Что запрещено</h2>
          <ul className="legal-list">
            <li>Использовать сервис для массового распространения вредоносного ПО или обхода защиты.</li>
            <li>Загружать материалы, на которые у вас нет прав доступа или разрешения владельца.</li>
            <li>Пытаться взломать инфраструктуру сайта, бота, кабинета или каналов поддержки.</li>
            <li>Использовать поддержку для спама, оскорблений, угроз или социальной инженерии.</li>
          </ul>
        </section>

        <section className="legal-section glass-panel">
          <h2>3. Поддержка и ручная проверка</h2>
          <p>
            Встроенный чат поддержки предназначен для вопросов по проверкам, статусам и спорным
            результатам. Ответы команды помогают понять вывод сервиса, но не заменяют внутренние
            процедуры безопасности вашей компании или проекта.
          </p>
        </section>

        <section className="legal-section glass-panel">
          <h2>4. Ответственность пользователя</h2>
          <ul className="legal-list">
            <li>Пользователь сам принимает финальное решение о запуске, удалении или публикации файла.</li>
            <li>Пользователь отвечает за сохранность своего аккаунта, почты и регистрационных данных.</li>
            <li>Если результат проверки спорный, рекомендуется не запускать объект до уточнения через поддержку.</li>
          </ul>
        </section>

        <section className="legal-section glass-panel">
          <h2>5. Ограничения сервиса</h2>
          <p>
            Ни один антивирусный сервис не может гарантировать абсолютное отсутствие риска. NeuralV
            снижает вероятность пропуска угроз, но не отменяет необходимость базовой цифровой
            гигиены, резервного копирования и аккуратной работы с неизвестными файлами.
          </p>
        </section>

        <section className="legal-section glass-panel">
          <h2>6. Нарушение правил</h2>
          <p>
            При злоупотреблении сервисом доступ к аккаунту, поддержке или отдельным функциям может
            быть ограничен без предварительного предупреждения.
          </p>
          <div className="legal-links">
            <Link to="/agreement" className="btn btn-outline">
              Перейти к соглашению
            </Link>
            <Link to="/login" className="btn btn-primary">
              Войти в аккаунт
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Rules;
