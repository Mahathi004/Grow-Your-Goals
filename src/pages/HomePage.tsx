import { motion } from 'framer-motion';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';

// Page transition variants shared across / and /auth so they cross-fade
// naturally without jarring scale/translate mismatches.
const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } },
  exit:    { opacity: 0, transition: { duration: 0.25, ease: [0.55, 0, 1, 0.45] as const } },
};

export default function HomePage() {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="relative z-10 flex flex-col min-h-screen"
    >
      <Navbar />
      <Hero />
    </motion.div>
  );
}
