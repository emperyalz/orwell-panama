import type {MetadataRoute} from 'next';
import {siteUrl} from '@/lib/site';
export default function robots():MetadataRoute.Robots{
 const preview=process.env.VERCEL_ENV==='preview';
 return {rules:preview?{userAgent:'*',disallow:'/'}:{userAgent:'*',allow:'/',disallow:['/admin','/api/','/multiplayer','/login']},sitemap:siteUrl('/sitemap.xml')};
}
