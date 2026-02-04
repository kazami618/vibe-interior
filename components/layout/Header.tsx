'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Ticket, LogOut, User, Plus, Home } from 'lucide-react';

export function Header() {
  const { user, userData, loading, signInWithGoogle, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Home className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-foreground">部屋づくりAI</span>
        </Link>

        {/* Navigation & Auth Section */}
        <div className="flex items-center space-x-3">
          {loading ? (
            <div className="text-sm text-muted-foreground">読み込み中...</div>
          ) : user && userData ? (
            <>
              {/* 新規作成ボタン */}
              <Button asChild size="sm" className="hidden sm:flex">
                <Link href="/design/new">
                  <Plus className="h-4 w-4 mr-1" />
                  新規作成
                </Link>
              </Button>

              {/* チケット残高 */}
              <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-secondary rounded-full">
                <Ticket className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  {userData.ticketBalance}
                </span>
              </div>

              {/* マイページボタン */}
              <Button asChild variant="ghost" size="sm" className="hidden sm:flex">
                <Link href="/mypage">
                  <User className="h-4 w-4 mr-1" />
                  マイページ
                </Link>
              </Button>

              {/* ユーザーメニュー */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center space-x-2 rounded-full hover:ring-2 hover:ring-primary/20 transition-all">
                    {userData.photoURL ? (
                      <Image
                        src={userData.photoURL}
                        alt={userData.displayName || 'User'}
                        width={36}
                        height={36}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium">
                        {userData.displayName?.charAt(0) || 'U'}
                      </div>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 border shadow-xl z-50" style={{ backgroundColor: 'white' }}>
                  {/* モバイル用リンク（PC版では非表示） */}
                  <div className="sm:hidden">
                    <DropdownMenuItem asChild>
                      <Link href="/mypage" className="cursor-pointer flex items-center">
                        <User className="h-4 w-4 mr-2" />
                        マイページ
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/design/new" className="cursor-pointer flex items-center">
                        <Plus className="h-4 w-4 mr-2" />
                        新規作成
                      </Link>
                    </DropdownMenuItem>
                  </div>
                  <DropdownMenuItem onClick={signOut} className="cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950">
                    <LogOut className="h-4 w-4 mr-2" />
                    ログアウト
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button onClick={signInWithGoogle} size="sm">
              Googleでログイン
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
