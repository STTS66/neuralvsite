import React from 'react';

import './Footer.css';

const Footer: React.FC = () => {
  return (
    <footer className="footer-area">
      <div className="footer-container">

        <div className="copyright">
          &copy; {new Date().getFullYear()} NeuralV Security. Все права защищены. <br />
          Инновации в сфере защиты данных.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
