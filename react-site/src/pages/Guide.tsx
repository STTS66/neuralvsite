import React from 'react';
import { motion } from 'framer-motion';
import { Download, ShieldCheck, Box } from 'lucide-react';
import './Guide.css';

const Guide: React.FC = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    show: { opacity: 1, x: 0, transition: { duration: 0.6 } }
  };

  return (
    <div className="guide-container">
      <div className="bg-glow guide-glow"></div>
      
      <div className="guide-content">
        <motion.div 
          className="guide-header"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="gradient-text">Как это работает?</h1>
          <p className="guide-subtitle">Узнайте, как проверить ваш проект на уязвимости с помощью NeuralV</p>
        </motion.div>

        <motion.div 
          className="guide-grid"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={itemVariants} className="guide-step glass-panel">
            <div className="step-number">1</div>
            <div className="step-icon">
              <Download size={32} />
            </div>
            <h3>Регистрация и Вход</h3>
            <p>Чтобы начать пользоваться NeuralV, вам необходимо создать аккаунт. Это займет всего минуту.</p>
            <ol className="guide-list">
              <li>Нажмите кнопку <strong>Войти</strong> в меню.</li>
              <li>Выберите "Создать аккаунт" или войдите через Google.</li>
              <li>После входа вы попадете в Личный кабинет.</li>
            </ol>
          </motion.div>

          <motion.div variants={itemVariants} className="guide-step glass-panel">
            <div className="step-number">2</div>
            <div className="step-icon">
              <Box size={32} />
            </div>
            <h3>Отправка проекта на проверку</h3>
            <p>В Личном кабинете вы можете отправить свой код на аудит безопасности.</p>
            <ol className="guide-list">
              <li>Загрузите проект на облако или скопируйте <strong>ссылку на пост в Telegram</strong>.</li>
              <li>Вставьте ссылку в поле ввода.</li>
              <li>Нажмите <strong>Отправить на проверку</strong>.</li>
            </ol>
            <p className="note-text">
              ℹ️ Первая проверка бесплатна. Последующие — 390 ₽ за проект.
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="guide-step glass-panel">
            <div className="step-number">3</div>
            <div className="step-icon">
              <ShieldCheck size={32} />
            </div>
            <h3>Получение результатов</h3>
            <p>Наша команда и ИИ-алгоритмы проверят ваш код. Статус заказа будет меняться в таблице "Мои Заказы".</p>
            <ul className="guide-list-bullets">
              <li>🕓 <strong>Pending</strong> — В ожидании проверки.</li>
              <li>✅ <strong>Active</strong> — Проверка пройдена, угроз нет.</li>
              <li>❌ <strong>Rejected</strong> — Обнаружены критические уязвимости.</li>
            </ul>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default Guide;
