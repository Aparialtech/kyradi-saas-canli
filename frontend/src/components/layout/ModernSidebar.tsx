import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import styles from './ModernSidebar.module.css';

export interface ModernSidebarNavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  badge?: string | number;
  end?: boolean;
}

interface ModernSidebarProps {
  items: ModernSidebarNavItem[];
  isOpen: boolean;
  onToggle: () => void;
  brandName?: string;
  brandLogo?: string;
}

export const ModernSidebar: React.FC<ModernSidebarProps> = ({
  items,
  isOpen,
  onToggle,
  brandName = 'KYRADI',
  brandLogo,
}) => {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  return (
    <>
      {/* Backdrop for mobile */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onToggle}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        className={clsx(styles.sidebar, {
          [styles.sidebarOpen]: isOpen,
        })}
        initial={false}
        animate={{
          width: isOpen ? '280px' : '80px',
        }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 30,
        }}
      >
        {/* Brand Header */}
        <div className={styles.brand}>
          <motion.div
            className={styles.brandIcon}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {brandLogo ? (
              <img src={brandLogo} alt={brandName} className={styles.brandLogo} />
            ) : (
              <div className={styles.brandLogoPlaceholder}>
                <span className="gradient-text">{brandName.charAt(0)}</span>
              </div>
            )}
          </motion.div>

          <AnimatePresence>
            {isOpen && (
              <motion.div
                className={styles.brandName}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                <span className="gradient-text">{brandName}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <nav className={styles.nav}>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(styles.navItem, {
                  [styles.navItemActive]: isActive,
                })
              }
              onMouseEnter={() => setHoveredItem(item.to)}
              onMouseLeave={() => setHoveredItem(null)}
              title={!isOpen ? item.label : undefined}
            >
              <motion.div
                className={styles.navItemContent}
                whileHover={{ x: isOpen ? 4 : 0 }}
                transition={{ type: 'spring', stiffness: 300 }}
                style={{ justifyContent: isOpen ? 'flex-start' : 'center' }}
              >
                <div className={styles.navItemIcon}>{item.icon}</div>

                <AnimatePresence>
                  {isOpen && (
                    <motion.span
                      className={styles.navItemLabel}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>

                {item.badge && isOpen && (
                  <motion.span
                    className={styles.navItemBadge}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    {item.badge}
                  </motion.span>
                )}
              </motion.div>

              {/* Active indicator */}
              <motion.div
                className={styles.navItemIndicator}
                initial={false}
                animate={{
                  opacity: hoveredItem === item.to ? 1 : 0,
                  scaleY: hoveredItem === item.to ? 1 : 0.5,
                }}
                transition={{ duration: 0.2 }}
              />
            </NavLink>
          ))}
        </nav>

        {/* Toggle Button */}
        <motion.button
          className={styles.toggleButton}
          onClick={onToggle}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </motion.div>
        </motion.button>
      </motion.aside>
    </>
  );
};

