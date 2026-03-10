import { motion } from "framer-motion";
import type { PropsWithChildren } from "react";

type RevealProps = PropsWithChildren<{
  delay?: number;
  y?: number;
}>;

export function Reveal({ children, delay = 0, y = 16 }: RevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      viewport={{ once: true, amount: 0.25 }}
    >
      {children}
    </motion.div>
  );
}
