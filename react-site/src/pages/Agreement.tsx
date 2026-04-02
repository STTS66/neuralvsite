import React from 'react';
import { FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import './Legal.css';

const Agreement: React.FC = () => {
  return (
    <div className="legal-page">
      <div className="legal-shell">
        <section className="legal-hero glass-panel">
          <div className="legal-badge">
            <FileText size={16} />
            <span>Пользовательское соглашение</span>
          </div>
          <h1 className="gradient-text legal-title">Соглашение об использовании NeuralV</h1>
          <p className="legal-updated">Актуально на 2 апреля 2026 года.</p>
          <p className="legal-intro">
            Это соглашение описывает базовые условия регистрации, использования личного кабинета,
            подтверждения почты, общения с поддержкой и передачи материалов на анализ.
          </p>
        </section>

        <section className="legal-section glass-panel">
          <h2>1. Регистрация и подтверждение почты</h2>
          <p>
            Для создания аккаунта пользователь указывает логин, email и пароль. Завершение регистрации
            происходит после подтверждения email кодом из письма. Это нужно для защиты аккаунта и
            доступа к встроенной поддержке.
          </p>
        </section>

        <section className="legal-section glass-panel">
          <h2>2. Использование аккаунта</h2>
          <ul className="legal-list">
            <li>Один аккаунт предназначен для персонального использования владельцем учетной записи.</li>
            <li>Пользователь обязуется не передавать доступ третьим лицам без необходимости.</li>
            <li>При подозрении на компрометацию данных пользователь должен сменить пароль и уведомить поддержку.</li>
          </ul>
        </section>

        <section className="legal-section glass-panel">
          <h2>3. Материалы, отправляемые на анализ</h2>
          <p>
            Загружаемые файлы, архивы, ссылки и сообщения используются для выполнения проверки,
            отображения результата в кабинете и сопровождения обращения в поддержку. Пользователь
            подтверждает, что имеет право на передачу этих материалов в сервис.
          </p>
        </section>

        <section className="legal-section glass-panel">
          <h2>4. Поддержка и сообщения</h2>
          <p>
            После входа в аккаунт пользователь получает доступ к встроенному чату поддержки. История
            переписки может храниться в системе для продолжения обращения и улучшения качества помощи.
          </p>
        </section>

        <section className="legal-section glass-panel">
          <h2>5. Ограничение гарантий</h2>
          <p>
            NeuralV предоставляет сервис проверки и оценки риска "как есть". Мы стремимся к высокой
            точности, но не можем гарантировать абсолютную безошибочность анализа и стопроцентное
            обнаружение всех угроз в каждом сценарии.
          </p>
        </section>

        <section className="legal-section glass-panel">
          <h2>6. Изменения сервиса и документов</h2>
          <p>
            Функции платформы, тексты страниц, правила и это соглашение могут обновляться по мере
            развития сервиса. Актуальная версия документов публикуется на сайте.
          </p>
        </section>

        <section className="legal-section glass-panel">
          <h2>7. Связь по вопросам использования</h2>
          <p>
            Если у пользователя есть вопросы по работе сервиса, регистрации или статусу проверки,
            следует использовать встроенный чат поддержки после входа в аккаунт.
          </p>
          <div className="legal-links">
            <Link to="/rules" className="btn btn-outline">
              Открыть правила
            </Link>
            <Link to="/login" className="btn btn-primary">
              Перейти к регистрации
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Agreement;
