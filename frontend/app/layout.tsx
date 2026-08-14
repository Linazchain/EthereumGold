import './globals.css';
import { Providers } from './providers';

export const metadata = {
  title: 'EthereumGold Protocol',
  description: 'Sustainable Yield Protocol with Invariant Accounting',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
