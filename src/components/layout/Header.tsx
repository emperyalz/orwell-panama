'use client';
import {usePathname} from 'next/navigation';
import {ProfileHeader} from '@/components/reference/ProfileHeader';
export function Header(){return usePathname()==='/multiplayer'?null:<ProfileHeader/>;}
