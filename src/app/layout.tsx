import "~/styles/globals.css";
import { GeistSans } from "geist/font/sans";
import { Provider } from "jotai";
import { Metadata } from 'next';
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "Waifu.AI",
  icons: {
    icon: "./static/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Provider>
      <html className={GeistSans.variable}>
        <body>
          {children}
          <Toaster 
            position="top-center" 
            toastOptions={{ 
              style: { 
                background: '#1a1a3e', 
                color: '#fff', 
                border: '1px solid rgba(255,255,255,0.1)' 
              } 
            }} 
          />
        </body>
      </html>
    </Provider>
  );
}