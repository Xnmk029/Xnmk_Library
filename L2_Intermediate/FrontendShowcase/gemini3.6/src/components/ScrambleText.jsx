import React, { useState, useEffect, useRef } from 'react';

const CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?/0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ\u30A0\u30A2\u30A4\u30A6\u30A8\u30AA\u30AB\u30AD\u30AF\u30B1\u30B3';

export const ScrambleText = ({
  text = '',
  className = '',
  scrambleOnHover = true,
  autoStart = true,
  speed = 30,
  as: Component = 'span'
}) => {
  const [displayText, setDisplayText] = useState(text);
  const [isHovered, setIsHovered] = useState(false);
  const animationFrameRef = useRef(null);

  const scramble = () => {
    let iteration = 0;
    const maxIterations = text.length;

    clearInterval(animationFrameRef.current);

    animationFrameRef.current = setInterval(() => {
      setDisplayText(
        text
          .split('')
          .map((char, index) => {
            if (char === ' ' || char === '\n') return char;
            if (index < iteration) {
              return text[index];
            }
            return CHARS[Math.floor(Math.random() * CHARS.length)];
          })
          .join('')
      );

      if (iteration >= maxIterations) {
        clearInterval(animationFrameRef.current);
        setDisplayText(text);
      }

      iteration += 1 / 2;
    }, speed);
  };

  useEffect(() => {
    if (autoStart) {
      scramble();
    } else {
      setDisplayText(text);
    }
    return () => clearInterval(animationFrameRef.current);
  }, [text]);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (scrambleOnHover) {
      scramble();
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  return (
    <Component
      className={`scramble-text ${isHovered ? 'hovered' : ''} ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {displayText}
    </Component>
  );
};
