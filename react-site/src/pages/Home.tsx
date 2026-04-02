import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Smartphone, Monitor, ShieldAlert, Cpu } from 'lucide-react';
import { Link } from 'react-router-dom';
import './Home.css';

let introShown = false;

const Home: React.FC = () => {
  const [showIntro, setShowIntro] = useState(!introShown);

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
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
  } as any;

  return (
    <div className="home-container">
      {/* Intro Splash */}
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
              Здесь вы увидете лучший антивирус от команды FatalErrorTeam
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section className="hero-section">
        {/* Abstract Background Elements */}
        <div className="bg-glow"></div>
        <div className="bg-glow bg-glow-secondary"></div>

        <motion.div
          className="hero-content glass-panel"
          variants={containerVariants}
          initial="hidden"
          animate={!showIntro ? "show" : "hidden"}
        >
          <motion.div variants={itemVariants} className="hero-icon-wrapper">
            <Shield className="hero-main-icon" size={80} />
          </motion.div>
          <motion.h1 variants={itemVariants} className="gradient-text hero-title">
            NeuralV
          </motion.h1>
          <motion.p variants={itemVariants} className="hero-subtitle">
            Базовые технологии ушли в прошлое. <br /> Встречайте новый стандарт безопасности на базе ИИ.
          </motion.p>
          <motion.div variants={itemVariants} className="hero-btns">
            <Link to="/login" className="btn btn-primary">Начать защиту</Link>
            <a href="#features" className="btn btn-outline">Подробнее</a>
          </motion.div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <motion.div
          className="section-header"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="gradient-text section-title">Единая Экосистема</h2>
        </motion.div>

        <div className="features-grid">
          {[
            { icon: <Smartphone size={40} />, title: 'Android', desc: 'Полная защита мобильных устройств. Сканирование приложений и защита в реальном времени.' },
            { icon: <Monitor size={40} />, title: 'PC Windows', desc: 'Максимальная производительность и нулевое влияние на систему благодаря облачным вычислениям.' },
            { icon: <ShieldAlert size={40} />, title: 'Плагин Extera', desc: 'Модифицированный Telegram с поддержкой плагинов для расширения функционала и защиты.' },
            { icon: <Cpu size={40} />, title: 'Модули для Юзерботов', desc: 'Надежные модули интеграции для ваших юзерботов в Telegram для безопасной автоматизации.' }
          ].map((feat, idx) => (
            <motion.div
              key={idx}
              className="feature-card glass-panel"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: idx * 0.1 }}
              whileHover={{ y: -10, scale: 1.02 }}
            >
              <div className="feature-icon">{feat.icon}</div>
              <h3>{feat.title}</h3>
              <p>{feat.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Security & AI Section */}
      <section className="security-section">
        <div className="security-container">
          <motion.div
            className="security-text"
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
          >
            <div className="security-badge">
              <Cpu size={18} />
              <span>Powered by Gemini</span>
            </div>
            <h2 className="gradient-text section-title" style={{ textAlign: 'left', marginBottom: '24px' }}>Интеллектуальная Безопасность</h2>
            <p className="security-desc">
              Мы не просто ищем вирусы по базам сигнатур. NeuralV использует продвинутые модели машинного
              обучения, включая <strong>Gemini</strong>, для анализа поведения программ.
            </p>
            <ul className="security-list">
              <li>
                <span className="check">✓</span> Анализ неизвестных угроз в реальном времени
              </li>
              <li>
                <span className="check">✓</span> Предиктивная защита от 0-day атак
              </li>
              <li>
                <span className="check">✓</span> Автоматическое обучение на новых вирусах
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
            <div className="gemini-glow-container">
              <motion.div
                className="gemini-brain"
                animate={{
                  boxShadow: [
                    "0 0 40px rgba(200, 200, 200, 0.2)",
                    "0 0 80px rgba(255, 255, 255, 0.4)",
                    "0 0 40px rgba(200, 200, 200, 0.2)"
                  ]
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <Shield size={120} className="gemini-icon" />
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>


    </div>
  );
};

export default Home;
