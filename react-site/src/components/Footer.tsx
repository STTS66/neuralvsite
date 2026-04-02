import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer: React.FC = () => {
  return (
    <footer className="footer-area">
      <div className="footer-container">
        <div className="footer-links">
          <Link to="/">Главная</Link>
          <Link to="/guide">Гайд</Link>
          <a href="/#faq">FAQ</a>
          <Link to="/rules">Правила</Link>
          <Link to="/agreement">Соглашение</Link>
          <Link to="/login">Вход</Link>
        </div>

        <div className="copyright">
          &copy; {new Date().getFullYear()} NeuralV Security. Все права защищены.
          <br />
          AI-проверка файлов, проектов и цифровых рисков в одном кабинете.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
