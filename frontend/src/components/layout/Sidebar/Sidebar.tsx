import React from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import styles from './Sidebar.module.css';

export interface SidebarNavItem {
  to: string;
  label: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  end?: boolean;
}

export interface SidebarProps {
  items: SidebarNavItem[];
  heading?: string;
  footer?: React.ReactNode;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  items,
  heading,
  footer,
  isOpen = true,
  onClose,
}) => {
  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className={clsx(
              styles['sidebar-overlay'],
              isOpen && styles['sidebar-overlay--visible']
            )}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        className={clsx(styles.sidebar, isOpen && styles['sidebar--open'])}
        initial={{ x: -280 }}
        animate={{ x: 0 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        <div className={styles.sidebar__content}>
          <nav>
            {heading && <p className={styles.sidebar__heading}>{heading}</p>}
            <div className={styles.sidebar__nav}>
              {items.map((item, index) => (
                <motion.div
                  key={item.to}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    delay: index * 0.05,
                    duration: 0.3,
                    ease: [0.4, 0, 0.2, 1],
                  }}
                >
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      clsx(
                        styles['sidebar__nav-item'],
                        isActive && styles['sidebar__nav-item--active']
                      )
                    }
                  >
                    {item.icon && (
                      <span className={styles['sidebar__nav-icon']}>{item.icon}</span>
                    )}
                    <span className={styles['sidebar__nav-label']}>{item.label}</span>
                    {item.badge && (
                      <span className={styles['sidebar__nav-badge']}>{item.badge}</span>
                    )}
                  </NavLink>
                </motion.div>
              ))}
            </div>
          </nav>
        </div>

        {footer && <div className={styles.sidebar__footer}>{footer}</div>}
      </motion.aside>
    </>
  );
};

