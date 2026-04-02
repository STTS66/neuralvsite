import React, { useEffect, useRef } from 'react';
import './Starfield.css';

const Starfield: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;
    let stars: { x: number, y: number, radius: number, speed: number }[] = [];
    let animationFrameId: number;

    const initStars = () => {
      stars = [];
      const numStars = Math.floor((width * height) / 3000); // Dynamic count based on screen size
      for (let i = 0; i < numStars; i++) {
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: Math.random() * 1.5 + 0.5,
          speed: Math.random() * 0.5 + 0.1
        });
      }
    };

    const drawStars = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#FFF';
      
      stars.forEach(star => {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
        
        star.y += star.speed;
        
        // Loop star to top
        if (star.y > height) {
          star.y = 0;
          star.x = Math.random() * width;
        }
      });
      
      animationFrameId = requestAnimationFrame(drawStars);
    };

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initStars();
    };

    window.addEventListener('resize', handleResize);
    initStars();
    drawStars();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="starfield-canvas"
    />
  );
};

export default Starfield;
