import { motion } from 'framer-motion';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';

export default function HomePage() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative z-10 flex flex-col min-h-screen"
    >
      <Navbar />
      <Hero />
    </motion.div>
  );
}

