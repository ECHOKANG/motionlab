import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: '映动 MotionLab · 每个灵感，都值得被看见', description: '把一句创意变成一支好视频。映动提供产品短片、社交视频的分镜生成、动画编辑、实时预览和视频导出。', icons: {icon:'/favicon.svg'} };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="zh-CN"><body>{children}</body></html>; }
