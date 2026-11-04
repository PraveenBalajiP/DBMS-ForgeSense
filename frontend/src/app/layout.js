import './globals.css';
import AuthProvider from '@/components/AuthProvider';
import Shell from '@/components/Shell';
import { ToastProvider } from '@/components/ui';

export const metadata = { title: 'IIoT Predictive Maintenance Engine' };
export default function RootLayout({ children }) {
  return (
    <html lang="en"><body>
      <ToastProvider><AuthProvider><Shell>{children}</Shell></AuthProvider></ToastProvider>
    </body></html>
  );
}
