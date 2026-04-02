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

const platformFeatures = [
  {
    icon: <Smartphone size={38} />,
    title: 'Android',
    desc: 'Проверка APK, мониторинг поведения приложений, контроль подозрительных разрешений и быстрые предупреждения о риске.',
  },
  {
    icon: <Monitor size={38} />,
    title: 'Windows PC',
    desc: 'Анализ исполняемых файлов, скриптов, архивов и процессов без перегруза системы и с понятным отчётом по угрозам.',
  },
  {
    icon: <ShieldAlert size={38} />,
    title: 'Telegram-проекты',
    desc: 'Проверка ботов, плагинов и файлов для Telegram на вредоносные вставки, подозрительные модули и опасную логику.',
  },
  {
    icon: <Cpu size={38} />,
    title: 'Автоматизация и модули',
    desc: 'Выявление скрытых триггеров, опасных зависимостей, неочевидных сетевых вызовов и нетипичных действий в коде.',
  },
];

const antivirusLayers = [
  {
    icon: <Search size={20} />,
    title: 'Глубокий анализ файла',
    text: 'NeuralV смотрит не только на сигнатуру. Мы разбираем структуру, упаковку, подозрительные строки, поведенческие маркеры и связки библиотек.',
  },
  {
    icon: <Cpu size={20} />,
    title: 'Поведенческая модель',
    text: 'Система оценивает, как программа может вести себя после запуска: какие процессы создаёт, какие запросы отправляет и где пытается закрепиться.',
  },
  {
    icon: <Lock size={20} />,
    title: 'Защита от новых угроз',
    text: 'Если сигнатуры ещё нет, модель всё равно может заметить подозрительный шаблон и пометить файл как потенциально опасный до появления массовых детектов.',
  },
  {
    icon: <Gauge size={20} />,
    title: 'Быстрый результат',
    text: 'Пользователь получает понятный статус, комментарий по риску и маршрут действий: можно ли запускать файл, что стоит перепроверить и когда писать в поддержку.',
  },
];

const faqItems = [
  {
    question: 'Что именно проверяет NeuralV?',
    answer:
      'Сервис анализирует файлы, архивы, скрипты, сборки для Windows и Android, а также Telegram-проекты. Проверка включает сигнатурный анализ, поведенческие эвристики и оценку подозрительных компонентов.',
  },
  {
    question: 'Это только база сигнатур или есть ИИ-анализ?',
    answer:
      'NeuralV не ограничивается базой сигнатур. Платформа использует поведенческий и контекстный анализ, чтобы замечать опасные паттерны даже в новых и малоизвестных угрозах.',
  },
  {
    question: 'Можно ли отправить ссылку, а не файл?',
    answer:
      'Да. В личном кабинете можно отправить ссылку на Telegram-пост, облако или другой источник, если по ней доступен проект или файл для проверки.',
  },
  {
    question: 'Как быстро приходит ответ?',
    answer:
      'Первичный результат формируется быстро, а при спорных случаях подключается дополнительная ручная проверка. Статус и результат появляются в личном кабинете.',
  },
  {
    question: 'Если что-то непонятно, куда писать?',
    answer:
      'После входа в аккаунт открывается встроенный диалог поддержки на сайте. Ответ от команды приходит прямо в этот чат, без перехода в Telegram.',
  },
];

const Home: React.FC = () => {
  const [showIntro, setShowIntro] = useState(!introShown);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

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
            Базовые антивирусы реагируют слишком поздно.
            <br />
            NeuralV заранее отслеживает подозрительное поведение, оценивает риск и помогает
            отсеивать опасные файлы до запуска.
          </motion.p>

          <motion.p variants={itemVariants} className="hero-description">
            Это не просто ещё один сканер. NeuralV объединяет сигнатурную проверку, анализ
            поведения, проверку подозрительных модулей и удобную поддержку прямо на сайте.
          </motion.p>

          <motion.ul variants={itemVariants} className="hero-points">
            <li>Анализ файлов, архивов, скриптов и сборок</li>
            <li>Выявление нестандартных и новых угроз</li>
            <li>Понятный результат и быстрый диалог с поддержкой</li>
          </motion.ul>

          <motion.div variants={itemVariants} className="hero-btns">
            <Link to="/login" className="btn btn-primary">
              Начать защиту
            </Link>
            <a href="#features" className="btn btn-outline">
              Подробнее
            </a>
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
          <h2 className="gradient-text section-title">Что именно защищает NeuralV</h2>
          <p className="section-lead">
            Платформа закрывает не один сценарий, а сразу несколько направлений, где чаще
            всего прячутся угрозы: пользовательские файлы, проекты, модули и автоматизация.
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
              Классический антивирус часто отвечает только тогда, когда угроза уже известна.
              NeuralV смотрит глубже: на структуру файла, способ упаковки, сетевую активность,
              поведение после запуска и аномальные паттерны в коде.
            </p>

            <p className="security-desc secondary">
              Такой подход помогает выявлять вредоносные сценарии раньше, особенно когда речь
              идёт о свежих сборках, нестандартных Telegram-модулях, скриптах и подозрительных
              автоматизациях.
            </p>

            <ul className="security-list">
              <li>
                <span className="check">✓</span> Поведенческий анализ вместо слепого поиска по
                сигнатурам
              </li>
              <li>
                <span className="check">✓</span> Более понятный результат для пользователя, а не
                просто сухой статус
              </li>
              <li>
                <span className="check">✓</span> Возможность сразу перейти к поддержке, если
                проект требует ручной оценки
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
              Не просто отметку "опасно" или "чисто", а понятную картину по рискам.
            </p>
          </motion.div>

          <div className="trust-grid">
            {[
              'Понятный статус проверки и история заказов в кабинете',
              'Быстрый способ отправить файл, архив или ссылку на проект',
              'Дополнительная оценка спорных случаев через поддержку',
              'Ощутимо более подробный анализ для Telegram-проектов и пользовательских модулей',
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
            Секция для тех, кто хочет быстро понять, как работает сервис и чего ожидать после
            отправки проекта на анализ.
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
    </div>
  );
};

export default Home;
