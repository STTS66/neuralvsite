import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2,
  Cpu,
  Gauge,
  HelpCircle,
  Lock,
  Monitor,
  Search,
  Shield,
  ShieldAlert,
  Smartphone,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import './Home.css';

let introShown = false;

const heroHighlights = [
  {
    title: 'Глубокое сканирование',
    text: 'Проверка файлов, архивов, APK и сборок с упором на структуру, поведение и скрытые зависимости.',
  },
  {
    title: 'Карантин и история',
    text: 'Подозрительные объекты, статусы проверок и история действий собираются в одном кабинете.',
  },
  {
    title: 'Поддержка на сайте',
    text: 'Если случай спорный, можно сразу написать в поддержку и получить ответ в этом же диалоге.',
  },
];

const platformFeatures = [
  {
    icon: <Smartphone size={38} />,
    title: 'Android',
    desc: 'Проверка APK, анализ разрешений, поведения приложений и подозрительных модулей до установки на устройство.',
  },
  {
    icon: <Monitor size={38} />,
    title: 'Windows PC',
    desc: 'Сканирование исполняемых файлов, архивов, скриптов и процессов без перегруза системы и с понятным результатом.',
  },
  {
    icon: <ShieldAlert size={38} />,
    title: 'Telegram-проекты',
    desc: 'Проверка ботов, модулей и файлов для Telegram на скрытые вставки, опасную логику и сетевые риски.',
  },
  {
    icon: <Cpu size={38} />,
    title: 'Автоматизация и модули',
    desc: 'Выявление скрытых триггеров, нетипичных сетевых вызовов, опасных зависимостей и обходных сценариев в коде.',
  },
];

const antivirusLayers = [
  {
    icon: <Search size={20} />,
    title: 'Анализ содержимого',
    text: 'NeuralV смотрит не только на сигнатуру. Сервис разбирает структуру файла, упаковку, строки, подключенные библиотеки и подозрительные маркеры.',
  },
  {
    icon: <Cpu size={20} />,
    title: 'Поведенческая модель',
    text: 'Оценивается, как программа может вести себя после запуска: какие процессы поднимает, куда стучится и пытается ли закрепиться в системе.',
  },
  {
    icon: <Lock size={20} />,
    title: 'Работа с новыми угрозами',
    text: 'Даже если свежей угрозы еще нет в общих базах, модель замечает подозрительные шаблоны и помечает файл как рискованный заранее.',
  },
  {
    icon: <Gauge size={20} />,
    title: 'Понятный итог',
    text: 'Пользователь получает не сухой статус, а объяснение уровня риска, рекомендации по действиям и быстрый канал связи с поддержкой.',
  },
];

const faqItems = [
  {
    question: 'Что именно проверяет NeuralV?',
    answer:
      'Сервис анализирует файлы, архивы, APK, исполняемые сборки, скрипты и Telegram-проекты. Проверка сочетает сигнатурный анализ, поведенческие эвристики и поиск подозрительных компонентов.',
  },
  {
    question: 'Это обычный антивирус или здесь есть AI-анализ?',
    answer:
      'NeuralV не ограничивается базой сигнатур. Платформа оценивает структуру, контекст и потенциальное поведение объекта, чтобы замечать опасные паттерны даже в новых и малоизвестных угрозах.',
  },
  {
    question: 'Что пользователь видит после проверки?',
    answer:
      'В кабинете появляется статус, краткое объяснение риска, история проверки и дальнейшие рекомендации. Если случай спорный, можно сразу открыть диалог с поддержкой на сайте.',
  },
  {
    question: 'Есть ли карантин и история действий?',
    answer:
      'Да. Архитектура, которую я посмотрел в папке ap1ii, как раз ориентирована на отдельные сервисы сканирования, карантина и статистики. Это хороший референс для дальнейшего развития кабинета.',
  },
  {
    question: 'Можно ли отправить ссылку, а не сам файл?',
    answer:
      'Да. В кабинете можно отправить ссылку на проект, Telegram-пост, облачное хранилище или другой источник, если по ней доступен файл или сборка для проверки.',
  },
  {
    question: 'Как быстро приходит ответ?',
    answer:
      'Первичный результат формируется быстро, а если объект требует ручной оценки, подключается поддержка. Статус и ответы появляются прямо в личном кабинете.',
  },
  {
    question: 'Что делать, если проверка или результат непонятны?',
    answer:
      'После входа в аккаунт открывается встроенный чат поддержки. Там можно отправить вопрос, получить ответ от команды и при необходимости приложить файлы или изображения.',
  },
];

const Home: React.FC = () => {
  const [showIntro, setShowIntro] = useState(!introShown);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  useEffect(() => {
    if (showIntro) {
      introShown = true;
      const timer = setTimeout(() => {
        setShowIntro(false);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [showIntro]);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.16,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: 'easeOut' } },
  } as const;

  return (
    <div className="home-container">
      <AnimatePresence>
        {showIntro && (
          <motion.div
            className="intro-overlay"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.8, ease: 'easeInOut' } }}
          >
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="intro-title"
            >
              Добро пожаловать.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 1.2 }}
              className="intro-subtitle"
            >
              Здесь начинается новая модель цифровой защиты для Windows, Android и Telegram-проектов.
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      <section className="hero-section">
        <div className="bg-glow" />
        <div className="bg-glow bg-glow-secondary" />

        <motion.div
          className="hero-content glass-panel"
          variants={containerVariants}
          initial="hidden"
          animate={!showIntro ? 'show' : 'hidden'}
        >
          <motion.div variants={itemVariants} className="hero-badge">
            <Shield size={16} />
            <span>AI-антивирус нового поколения</span>
          </motion.div>

          <motion.div variants={itemVariants} className="hero-icon-wrapper">
            <Shield className="hero-main-icon" size={80} />
          </motion.div>

          <motion.h1 variants={itemVariants} className="gradient-text hero-title">
            NeuralV
          </motion.h1>

          <motion.p variants={itemVariants} className="hero-subtitle">
            NeuralV анализирует файлы, архивы, APK и Telegram-проекты не только по сигнатурам, но и
            по поведению, структуре и скрытым зависимостям.
            <br />
            Сервис замечает рискованные действия заранее, до запуска файла и до распространения
            угрозы.
          </motion.p>

          <motion.p variants={itemVariants} className="hero-description">
            Это не просто еще один сканер. В одном кабинете объединены проверка, история статусов,
            поддержка, ручная оценка спорных случаев и основа для карантина и статистики по
            проверкам. Такой формат подходит и для обычного пользователя, и для тех, кто проверяет
            сборки, модули и Telegram-проекты.
          </motion.p>

          <motion.ul variants={itemVariants} className="hero-points">
            <li>Проверка файлов, архивов, APK, скриптов и ссылок на проекты</li>
            <li>AI-анализ поведения, зависимостей, подозрительных сетевых вызовов и скрытых триггеров</li>
            <li>История проверок, понятный статус риска и быстрый доступ к поддержке прямо на сайте</li>
          </motion.ul>

          <motion.div variants={itemVariants} className="hero-btns">
            <Link to="/login" className="btn btn-primary">
              Начать защиту
            </Link>
            <a href="#features" className="btn btn-outline">
              Подробнее
            </a>
          </motion.div>

          <motion.div variants={itemVariants} className="hero-highlights">
            {heroHighlights.map((item) => (
              <article key={item.title} className="hero-highlight">
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </motion.div>
        </motion.div>
      </section>

      <section id="features" className="features-section">
        <motion.div
          className="section-header"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="gradient-text section-title">Что проверяет NeuralV</h2>
          <p className="section-lead">
            Платформа закрывает не один сценарий, а сразу несколько направлений, где чаще всего
            скрываются угрозы: пользовательские файлы, сборки, модули, Telegram-проекты и
            автоматизация.
          </p>
        </motion.div>

        <div className="features-grid">
          {platformFeatures.map((feat, idx) => (
            <motion.div
              key={feat.title}
              className="feature-card glass-panel"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.6, delay: idx * 0.08 }}
              whileHover={{ y: -8, scale: 1.015 }}
            >
              <div className="feature-icon">{feat.icon}</div>
              <h3>{feat.title}</h3>
              <p>{feat.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="security-section">
        <div className="security-container">
          <motion.div
            className="security-text"
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.8 }}
          >
            <div className="security-badge">
              <Cpu size={18} />
              <span>Многоуровневый антивирусный анализ</span>
            </div>

            <h2 className="gradient-text section-title security-title">
              Почему NeuralV сильнее обычной проверки по базе
            </h2>

            <p className="security-desc">
              Классический антивирус часто отвечает только тогда, когда угроза уже известна. NeuralV
              смотрит глубже: на структуру файла, способ упаковки, сетевую активность, поведение после
              запуска и аномальные паттерны в коде.
            </p>

            <p className="security-desc secondary">
              Такой подход помогает выявлять вредоносные сценарии раньше. Особенно это важно для свежих
              сборок, нестандартных Telegram-модулей, скриптов, архивов и автоматизаций, которые не
              всегда успевают попасть в классические базы угроз.
            </p>

            <ul className="security-list">
              <li>
                <span className="check">✓</span> Поведенческий анализ вместо слепого поиска по сигнатурам
              </li>
              <li>
                <span className="check">✓</span> Понятный результат для пользователя, а не просто сухой статус
              </li>
              <li>
                <span className="check">✓</span> Возможность сразу перейти к поддержке, если проект требует ручной оценки
              </li>
            </ul>
          </motion.div>

          <motion.div
            className="security-visual"
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
          >
            <div className="analysis-grid">
              {antivirusLayers.map((layer, index) => (
                <motion.article
                  key={layer.title}
                  className="analysis-card glass-panel"
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.08 }}
                >
                  <div className="analysis-card-head">
                    <span className="analysis-icon">{layer.icon}</span>
                    <h3>{layer.title}</h3>
                  </div>
                  <p>{layer.text}</p>
                </motion.article>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="trust-section">
        <div className="trust-container">
          <motion.div
            className="section-header compact"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <h2 className="gradient-text section-title">Что получает пользователь</h2>
            <p className="section-lead">
              Не просто отметку "опасно" или "чисто", а понятную картину по рискам, статусам и следующим
              действиям.
            </p>
          </motion.div>

          <div className="trust-grid">
            {[
              'Понятный статус проверки и история всех отправленных файлов или проектов в кабинете',
              'Быстрый способ отправить файл, архив, APK или ссылку на проект для анализа',
              'Дополнительная ручная оценка спорных случаев через поддержку прямо на сайте',
              'Более глубокий анализ для Telegram-проектов, пользовательских модулей и автоматизации',
            ].map((item, index) => (
              <motion.div
                key={item}
                className="trust-item glass-panel"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: index * 0.06 }}
              >
                <CheckCircle2 size={20} />
                <span>{item}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="faq-section">
        <motion.div
          className="section-header"
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7 }}
        >
          <div className="faq-badge">
            <HelpCircle size={16} />
            <span>Частые вопросы</span>
          </div>
          <h2 className="gradient-text section-title">FAQ по проверке и защите</h2>
          <p className="section-lead">
            Секция для тех, кто хочет быстро понять, как работает сервис, что именно проверяется и
            какой результат приходит после анализа.
          </p>
        </motion.div>

        <div className="faq-list">
          {faqItems.map((item, index) => {
            const isOpen = openFaqIndex === index;

            return (
              <motion.article
                key={item.question}
                className={`faq-item glass-panel ${isOpen ? 'open' : ''}`}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ duration: 0.45, delay: index * 0.05 }}
              >
                <button
                  type="button"
                  className="faq-question"
                  onClick={() => setOpenFaqIndex((current) => (current === index ? null : index))}
                >
                  <span>{item.question}</span>
                  <span className="faq-toggle">{isOpen ? '−' : '+'}</span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      className="faq-answer-wrap"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <p className="faq-answer">{item.answer}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.article>
            );
          })}
        </div>
      </section>

      <section className="legal-preview-section">
        <div className="trust-container">
          <motion.div
            className="section-header compact"
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.65 }}
          >
            <h2 className="gradient-text section-title">Правила и соглашение</h2>
            <p className="section-lead">
              Мы вынесли базовые условия использования сервиса в отдельные документы, чтобы ими было
              удобно пользоваться и с компьютера, и с телефона.
            </p>
          </motion.div>

          <div className="legal-preview-grid">
            <article className="legal-preview-card glass-panel">
              <h3>Правила сервиса</h3>
              <p>
                Что можно отправлять на проверку, какие сценарии запрещены, как работает поддержка и
                где проходит граница ответственности пользователя.
              </p>
              <Link to="/rules" className="btn btn-outline legal-preview-btn">
                Открыть правила
              </Link>
            </article>

            <article className="legal-preview-card glass-panel">
              <h3>Пользовательское соглашение</h3>
              <p>
                Условия регистрации, подтверждения почты, использования аккаунта, обработки материалов
                и взаимодействия с сервисом NeuralV.
              </p>
              <Link to="/agreement" className="btn btn-outline legal-preview-btn">
                Открыть соглашение
              </Link>
            </article>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
