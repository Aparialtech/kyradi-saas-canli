import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { Bell, LogOut, User, Settings, ChevronDown } from '../../lib/lucide';
import styles from './TopBar.module.css';

export interface TopBarProps {
  variant?: 'partner' | 'admin';
  title?: string;
  subtitle?: string;
  userEmail?: string;
  userName?: string;
  userAvatar?: string;
  onLogout?: () => void;
  onProfileClick?: () => void;
  actions?: React.ReactNode;
  className?: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  variant = 'partner',
  title,
  subtitle,
  userEmail,
  userName,
  userAvatar,
  onLogout,
  onProfileClick,
  actions,
  className,
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);

  const userInitials = userName
    ? userName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : userEmail
      ? userEmail.slice(0, 2).toUpperCase()
      : 'U';

  return (
    <motion.header
      className={clsx(styles.topBar, styles[`topBar--${variant}`], className)}
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className={styles.topBarContainer}>
        {/* Left Section */}
        <div className={styles.topBarLeft}>
          {title && (
            <div className={styles.topBarTitle}>
              <h1 className={styles.title}>{title}</h1>
              {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
            </div>
          )}
        </div>

        {/* Right Section */}
        <div className={styles.topBarRight}>
          {/* Actions */}
          {actions && <div className={styles.actions}>{actions}</div>}

          {/* Notifications */}
          <button className={styles.iconButton} aria-label="Notifications">
            <Bell className="h-5 w-5" />
          </button>

          {/* User Menu */}
          <div className={styles.userMenu}>
            <button
              className={styles.userButton}
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              <div className={styles.avatar}>
                {userAvatar ? (
                  <img src={userAvatar} alt={userName || 'User'} className={styles.avatarImage} />
                ) : (
                  <div className={styles.avatarPlaceholder}>
                    <span>{userInitials}</span>
                  </div>
                )}
              </div>
              <div className={styles.userInfo}>
                {userName && <span className={styles.userName}>{userName}</span>}
                {userEmail && <span className={styles.userEmail}>{userEmail}</span>}
              </div>
              <ChevronDown
                className={clsx(styles.chevron, showUserMenu && styles.chevronOpen)}
              />
            </button>

            {/* Dropdown Menu */}
            <AnimatePresence>
              {showUserMenu && (
                <motion.div
                  className={styles.dropdown}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {onProfileClick && (
                    <button className={styles.dropdownItem} onClick={onProfileClick}>
                      <User className="h-4 w-4" />
                      <span>Profile</span>
                    </button>
                  )}
                  <button className={styles.dropdownItem}>
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </button>
                  {onLogout && (
                    <button className={styles.dropdownItem} onClick={onLogout}>
                      <LogOut className="h-4 w-4" />
                      <span>Logout</span>
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Admin Badge */}
          {variant === 'admin' && (
            <span className={styles.adminBadge}>Admin Paneli</span>
          )}
        </div>
      </div>
    </motion.header>
  );
};

