import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'こころ日記',
  description: '出来事・気持ち・体の状態を記録して、落ち込みのきっかけを見つける',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@300;400;500;700&family=Noto+Serif+JP:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
