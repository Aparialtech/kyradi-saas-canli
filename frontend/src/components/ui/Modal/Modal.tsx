import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import styles from './Modal.module.css';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  children: React.ReactNode;
  closeOnOverlay?: boolean;
  closeOnEscape?: boolean;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  size = 'md',
  children,
  closeOnOverlay = true,
  closeOnEscape = true,
  className,
}) => {
  useEffect(() => {
    if (!closeOnEscape || !isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, closeOnEscape]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnOverlay && e.target === e.currentTarget) {
      onClose();
    }
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={styles['modal-overlay']}
          onClick={handleOverlayClick}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className={clsx(
              styles['modal-container'],
              styles[`modal-container--${size}`],
              className
            )}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
};

export interface ModalHeaderProps {
  title?: string;
  description?: string;
  onClose?: () => void;
  children?: React.ReactNode;
  className?: string;
}

export const ModalHeader: React.FC<ModalHeaderProps> = ({
  title,
  description,
  onClose,
  children,
  className,
}) => {
  return (
    <div className={clsx(styles['modal-header'], className)}>
      <div className={styles['modal-header__content']}>
        {children || (
          <>
            {title && <h2 className={styles['modal-header__title']}>{title}</h2>}
            {description && <p className={styles['modal-header__description']}>{description}</p>}
          </>
        )}
      </div>
      {onClose && (
        <button
          className={styles['modal-header__close']}
          onClick={onClose}
          aria-label="Close modal"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}
    </div>
  );
};

export interface ModalBodyProps {
  noPadding?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const ModalBody: React.FC<ModalBodyProps> = ({
  noPadding = false,
  children,
  className,
}) => {
  return (
    <div
      className={clsx(
        styles['modal-body'],
        noPadding && styles['modal-body--no-padding'],
        className
      )}
    >
      {children}
    </div>
  );
};

export interface ModalFooterProps {
  justify?: 'start' | 'end' | 'between';
  children: React.ReactNode;
  className?: string;
}

export const ModalFooter: React.FC<ModalFooterProps> = ({
  justify = 'end',
  children,
  className,
}) => {
  return (
    <div
      className={clsx(
        styles['modal-footer'],
        justify === 'end' && styles['modal-footer--end'],
        justify === 'between' && styles['modal-footer--between'],
        className
      )}
    >
      {children}
    </div>
  );
};

