import React from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import styles from './TopNav.module.css';

export interface TopNavProps {
  variant?: 'default' | 'partner' | 'admin';
  brandMark?: string;
  brandText?: string;
  userEmail?: string;
  onLogout?: () => void;
  children?: React.ReactNode;
}

export const TopNav: React.FC<TopNavProps> = ({
  variant = 'default',
  brandMark = 'KY',
  brandText = 'Kyradi',
  userEmail,
  onLogout,
  children,
}) => {
  return (
    <motion.header
      className={clsx(
        styles.topnav,
        variant !== 'default' && styles[`topnav--${variant}`]
      )}
      initial={{ y: -64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className={styles.topnav__brand}>
        <motion.div
          className={styles['topnav__brand-mark']}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {brandMark}
        </motion.div>
        <span className={styles['topnav__brand-text']}>{brandText}</span>
      </div>

      <div className={styles.topnav__user}>
        {children}
        {userEmail && <span className={styles['topnav__user-email']}>{userEmail}</span>}
        {onLogout && (
          <motion.button
            className={styles['topnav__logout-btn']}
            onClick={onLogout}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Logout
          </motion.button>
        )}
      </div>
    </motion.header>
  );
};

