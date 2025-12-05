import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { Menu, X } from '../../lib/lucide';
import styles from './SidebarNav.module.css';

export interface SidebarNavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  badge?: string | number;
  end?: boolean;
}

export interface SidebarNavProps {
  variant?: 'partner' | 'admin';
  items: SidebarNavItem[];
  heading?: string;
  brandName?: string;
  brandLogo?: React.ReactNode;
  className?: string;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  variant = 'partner',
  items,
  heading,
  brandName = 'KYRADI',
  brandLogo,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth > 768);
    };
    
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  const isActive = (item: SidebarNavItem) => {
    if (item.end) {
      return location.pathname === item.to || location.pathname === `${item.to}/`;
    }
    return location.pathname.startsWith(item.to);
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        className={styles.mobileToggle}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle menu"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        className={clsx(
          styles.sidebar,
          styles[`sidebar--${variant}`],
          isOpen && styles.sidebarOpen,
          className
        )}
        initial={false}
        animate={{
          x: isOpen ? 0 : window.innerWidth > 768 ? 0 : -280,
        }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 30,
        }}
      >
        {/* Brand Header */}
        <div className={styles.brand}>
          {brandLogo ? (
            <div className={styles.brandLogo}>{brandLogo}</div>
          ) : (
            <div className={styles.brandIcon}>
              <span className={styles.brandInitial}>{brandName.charAt(0)}</span>
            </div>
          )}
          <AnimatePresence>
            {(isOpen || isDesktop) && (
              <motion.div
                className={styles.brandName}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                {brandName}
                {variant === 'admin' && (
                  <span className={styles.adminBadge}>Admin</span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Heading */}
        {heading && (isOpen || window.innerWidth > 768) && (
          <div className={styles.heading}>{heading}</div>
        )}

        {/* Navigation */}
        <nav className={styles.nav}>
          {items.map((item, index) => {
            const active = isActive(item);
            return (
              <motion.div
                key={item.to}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  delay: index * 0.05,
                  duration: 0.3,
                }}
              >
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive: navActive }) =>
                    clsx(
                      styles.navItem,
                      (active || navActive) && styles.navItemActive
                    )
                  }
                  onClick={() => {
                    if (!isDesktop) {
                      setIsOpen(false);
                    }
                  }}
                >
                  <span className={styles.navIcon}>{item.icon}</span>
                  {(isOpen || isDesktop) && (
                    <>
                      <span className={styles.navLabel}>{item.label}</span>
                      {item.badge && (
                        <span className={styles.navBadge}>{item.badge}</span>
                      )}
                    </>
                  )}
                </NavLink>
              </motion.div>
            );
          })}
        </nav>
      </motion.aside>
    </>
  );
};

