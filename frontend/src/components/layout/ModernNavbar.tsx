import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import styles from './ModernNavbar.module.css';

interface ModernNavbarProps {
  title?: string;
  subtitle?: string;
  userRole?: string;
  userName?: string;
  userAvatar?: string;
  onLogout?: () => void;
  onProfileClick?: () => void;
  onSettingsClick?: () => void;
  actions?: React.ReactNode;
  sidebarToggle?: React.ReactNode;
}

export const ModernNavbar: React.FC<ModernNavbarProps> = ({
  title,
  subtitle,
  userRole = 'Partner',
  userName = 'Kullanıcı',
  userAvatar,
  onLogout,
  onProfileClick,
  onSettingsClick,
  actions,
  sidebarToggle,
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);

  const userInitials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <motion.header
      className={styles.navbar}
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <div className={styles.navbarContainer}>
        {/* Left Section */}
        <div className={styles.navbarLeft}>
          {sidebarToggle}
          
          {title && (
            <div className={styles.navbarTitle}>
              <h1 className={styles.title}>{title}</h1>
              {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
            </div>
          )}
        </div>

        {/* Right Section */}
        <div className={styles.navbarRight}>
          {/* Actions */}
          {actions && <div className={styles.actions}>{actions}</div>}

          {/* User Profile */}
          <div className={styles.userSection}>
            <motion.button
              className={styles.userButton}
              onClick={() => setShowUserMenu(!showUserMenu)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Avatar */}
              <div className={styles.avatar}>
                {userAvatar ? (
                  <img src={userAvatar} alt={userName} className={styles.avatarImage} />
                ) : (
                  <div className={styles.avatarPlaceholder}>
                    <span>{userInitials}</span>
                  </div>
                )}
                <div className={styles.avatarStatus} />
              </div>

              {/* User Info */}
              <div className={styles.userInfo}>
                <span className={styles.userName}>{userName}</span>
                <span className={styles.userRole}>{userRole}</span>
              </div>

              {/* Dropdown Icon */}
              <motion.div
                className={styles.dropdownIcon}
                animate={{ rotate: showUserMenu ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </motion.div>
            </motion.button>

            {/* Dropdown Menu */}
            <AnimatePresence>
              {showUserMenu && (
                <>
                  <motion.div
                    className={styles.dropdownBackdrop}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowUserMenu(false)}
                  />
                  <motion.div
                    className={styles.dropdownMenu}
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                  >
                    {onProfileClick && (
                      <button
                        className={styles.dropdownItem}
                        onClick={() => {
                          onProfileClick();
                          setShowUserMenu(false);
                        }}
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                        <span>Profil</span>
                      </button>
                    )}

                    {onSettingsClick && (
                      <button
                        className={styles.dropdownItem}
                        onClick={() => {
                          onSettingsClick();
                          setShowUserMenu(false);
                        }}
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        <span>Ayarlar</span>
                      </button>
                    )}

                    <div className={styles.dropdownDivider} />

                    {onLogout && (
                      <button
                        className={clsx(styles.dropdownItem, styles.dropdownItemDanger)}
                        onClick={() => {
                          onLogout();
                          setShowUserMenu(false);
                        }}
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                          <polyline points="16 17 21 12 16 7" />
                          <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        <span>Çıkış Yap</span>
                      </button>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.header>
  );
};

