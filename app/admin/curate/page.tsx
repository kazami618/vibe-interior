'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  startAfter,
  Timestamp,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import {
  ArrowLeft,
  ArrowRight,
  ArrowDown,
  CheckCircle,
  XCircle,
  SkipForward,
  Undo2,
  Loader2,
  Inbox,
  Keyboard,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { useAdmin } from '@/lib/admin';
import { Button } from '@/components/ui/button';
import type { Product } from '@/lib/types/product';
import type { ItemCategory, DesignStyle } from '@/lib/types/design';
import ProductCard from '@/components/admin/ProductCard';
import CurationStats from '@/components/admin/CurationStats';

const BATCH_SIZE = 50;
const REFETCH_THRESHOLD = 10;

interface UndoAction {
  product: Product;
  previousStatus: Product['status'];
  decision: 'approved' | 'rejected';
  editedCategory: ItemCategory;
  editedStyle: DesignStyle;
  editedTags: string[];
}

export default function CuratePage() {
  const { user } = useAdmin();
  const [products, setProducts] = useState<Product[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [sessionStats, setSessionStats] = useState({
    approved: 0,
    rejected: 0,
    skipped: 0,
  });

  // Per-product editable state
  const [editedCategory, setEditedCategory] = useState<ItemCategory | null>(null);
  const [editedStyle, setEditedStyle] = useState<DesignStyle | null>(null);
  const [editedTags, setEditedTags] = useState<string[] | null>(null);

  // Review timing
  const reviewStartRef = useRef<number>(Date.now());

  // Current product
  const currentProduct = products[currentIndex] ?? null;

  // Initialize edited values when product changes
  useEffect(() => {
    if (currentProduct) {
      setEditedCategory(currentProduct.category);
      setEditedStyle(currentProduct.style);
      setEditedTags([...currentProduct.tags]);
      reviewStartRef.current = Date.now();
    }
  }, [currentProduct?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch products from Firestore
  const fetchProducts = useCallback(
    async (afterDoc?: QueryDocumentSnapshot<DocumentData> | null) => {
      if (fetching) return;
      setFetching(true);

      try {
        let q;
        if (afterDoc) {
          q = query(
            collection(db, 'products'),
            where('status', '==', 'candidate'),
            orderBy('createdAt', 'asc'),
            startAfter(afterDoc),
            limit(BATCH_SIZE)
          );
        } else {
          q = query(
            collection(db, 'products'),
            where('status', '==', 'candidate'),
            orderBy('createdAt', 'asc'),
            limit(BATCH_SIZE)
          );
        }

        const snapshot = await getDocs(q);
        const newProducts: Product[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Product[];

        if (snapshot.docs.length > 0) {
          setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
        }

        if (snapshot.docs.length < BATCH_SIZE) {
          setHasMore(false);
        }

        setProducts((prev) =>
          afterDoc ? [...prev, ...newProducts] : newProducts
        );
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setFetching(false);
        setLoading(false);
      }
    },
    [fetching]
  );

  // Initial fetch
  useEffect(() => {
    fetchProducts();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fetch more when running low
  useEffect(() => {
    const remaining = products.length - currentIndex;
    if (remaining <= REFETCH_THRESHOLD && hasMore && !fetching) {
      fetchProducts(lastDoc);
    }
  }, [currentIndex, products.length, hasMore, fetching, lastDoc, fetchProducts]);

  // Hide undo toast after delay
  useEffect(() => {
    if (!showUndoToast) return;
    const timer = setTimeout(() => setShowUndoToast(false), 4000);
    return () => clearTimeout(timer);
  }, [showUndoToast]);

  // Handle approve
  const handleApprove = useCallback(async () => {
    if (!currentProduct || !user) return;

    const reviewDurationMs = Date.now() - reviewStartRef.current;
    const cat = editedCategory ?? currentProduct.category;
    const sty = editedStyle ?? currentProduct.style;
    const tgs = editedTags ?? currentProduct.tags;

    try {
      // Update product status
      await updateDoc(doc(db, 'products', currentProduct.id), {
        status: 'approved',
        category: cat,
        style: sty,
        tags: tgs,
        curatedAt: serverTimestamp(),
        curatedBy: user.uid,
        updatedAt: serverTimestamp(),
      });

      // Save review record
      await addDoc(collection(db, 'productReviews'), {
        productId: currentProduct.id,
        decision: 'approved',
        originalCategory: currentProduct.category,
        editedCategory: cat !== currentProduct.category ? cat : null,
        originalStyle: currentProduct.style,
        editedStyle: sty !== currentProduct.style ? sty : null,
        originalTags: currentProduct.tags,
        editedTags:
          JSON.stringify(tgs) !== JSON.stringify(currentProduct.tags)
            ? tgs
            : null,
        reviewedBy: user.uid,
        reviewedAt: serverTimestamp(),
        reviewDurationMs,
      });

      // Push undo
      setUndoStack((prev) => [
        ...prev,
        {
          product: currentProduct,
          previousStatus: 'candidate',
          decision: 'approved',
          editedCategory: cat,
          editedStyle: sty,
          editedTags: tgs,
        },
      ]);

      setSessionStats((prev) => ({ ...prev, approved: prev.approved + 1 }));
      setShowUndoToast(true);
      setCurrentIndex((prev) => prev + 1);
    } catch (error) {
      console.error('Error approving product:', error);
    }
  }, [currentProduct, user, editedCategory, editedStyle, editedTags]);

  // Handle reject
  const handleReject = useCallback(async () => {
    if (!currentProduct || !user) return;

    const reviewDurationMs = Date.now() - reviewStartRef.current;
    const cat = editedCategory ?? currentProduct.category;
    const sty = editedStyle ?? currentProduct.style;
    const tgs = editedTags ?? currentProduct.tags;

    try {
      await updateDoc(doc(db, 'products', currentProduct.id), {
        status: 'rejected',
        curatedAt: serverTimestamp(),
        curatedBy: user.uid,
        updatedAt: serverTimestamp(),
      });

      await addDoc(collection(db, 'productReviews'), {
        productId: currentProduct.id,
        decision: 'rejected',
        originalCategory: currentProduct.category,
        editedCategory: cat !== currentProduct.category ? cat : null,
        originalStyle: currentProduct.style,
        editedStyle: sty !== currentProduct.style ? sty : null,
        originalTags: currentProduct.tags,
        editedTags:
          JSON.stringify(tgs) !== JSON.stringify(currentProduct.tags)
            ? tgs
            : null,
        reviewedBy: user.uid,
        reviewedAt: serverTimestamp(),
        reviewDurationMs,
      });

      setUndoStack((prev) => [
        ...prev,
        {
          product: currentProduct,
          previousStatus: 'candidate',
          decision: 'rejected',
          editedCategory: cat,
          editedStyle: sty,
          editedTags: tgs,
        },
      ]);

      setSessionStats((prev) => ({ ...prev, rejected: prev.rejected + 1 }));
      setShowUndoToast(true);
      setCurrentIndex((prev) => prev + 1);
    } catch (error) {
      console.error('Error rejecting product:', error);
    }
  }, [currentProduct, user, editedCategory, editedStyle, editedTags]);

  // Handle skip
  const handleSkip = useCallback(() => {
    if (!currentProduct) return;
    setSessionStats((prev) => ({ ...prev, skipped: prev.skipped + 1 }));
    setCurrentIndex((prev) => prev + 1);
  }, [currentProduct]);

  // Handle undo
  const handleUndo = useCallback(async () => {
    if (undoStack.length === 0) return;

    const lastAction = undoStack[undoStack.length - 1];

    try {
      // Revert product status
      await updateDoc(doc(db, 'products', lastAction.product.id), {
        status: 'candidate',
        category: lastAction.product.category,
        style: lastAction.product.style,
        tags: lastAction.product.tags,
        curatedAt: null,
        curatedBy: null,
        updatedAt: serverTimestamp(),
      });

      // Update stats
      setSessionStats((prev) => ({
        ...prev,
        [lastAction.decision === 'approved' ? 'approved' : 'rejected']:
          prev[lastAction.decision === 'approved' ? 'approved' : 'rejected'] - 1,
      }));

      // Remove from undo stack
      setUndoStack((prev) => prev.slice(0, -1));

      // Go back
      setCurrentIndex((prev) => Math.max(0, prev - 1));
      setShowUndoToast(false);
    } catch (error) {
      console.error('Error undoing action:', error);
    }
  }, [undoStack]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keyboard shortcuts when typing in an input/select
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      switch (e.key) {
        case 'ArrowRight':
        case 'a':
          e.preventDefault();
          handleApprove();
          break;
        case 'ArrowLeft':
        case 'r':
          e.preventDefault();
          handleReject();
          break;
        case 'ArrowDown':
        case 's':
          e.preventDefault();
          handleSkip();
          break;
        case 'z':
          e.preventDefault();
          handleUndo();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleApprove, handleReject, handleSkip, handleUndo]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">商品データを読み込み中...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (!currentProduct && !fetching) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4 text-center px-4">
          <Inbox className="h-16 w-16 text-muted-foreground" />
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              レビュー待ちの商品はありません
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              全ての候補商品のレビューが完了しました
            </p>
          </div>
          {(sessionStats.approved > 0 || sessionStats.rejected > 0) && (
            <div className="mt-4 p-4 rounded-lg border border-border bg-card">
              <p className="text-sm text-muted-foreground mb-2">
                セッション結果
              </p>
              <div className="flex gap-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-500">
                    {sessionStats.approved}
                  </p>
                  <p className="text-xs text-muted-foreground">承認</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-500">
                    {sessionStats.rejected}
                  </p>
                  <p className="text-xs text-muted-foreground">却下</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-muted-foreground">
                    {sessionStats.skipped}
                  </p>
                  <p className="text-xs text-muted-foreground">スキップ</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-foreground">
            商品キュレーション
          </h1>
          <CurationStats sessionStats={sessionStats} />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center px-4 py-6">
        {/* Progress indicator */}
        <div className="text-xs text-muted-foreground mb-4">
          {currentIndex + 1} / {products.length}
          {hasMore && '+'}
          {fetching && (
            <Loader2 className="inline h-3 w-3 ml-1 animate-spin" />
          )}
        </div>

        {/* Product card */}
        {currentProduct && (
          <ProductCard
            product={currentProduct}
            category={editedCategory ?? currentProduct.category}
            style={editedStyle ?? currentProduct.style}
            tags={editedTags ?? currentProduct.tags}
            onCategoryChange={setEditedCategory}
            onStyleChange={setEditedStyle}
            onTagsChange={setEditedTags}
          />
        )}

        {/* Action buttons */}
        <div className="relative z-20 flex items-center justify-center gap-4 mt-6 w-full max-w-2xl">
          {/* Reject */}
          <Button
            variant="outline"
            size="lg"
            onClick={handleReject}
            className="flex-1 h-14 border-red-500/30 hover:bg-red-500/10 hover:border-red-500/50 text-red-500 transition-all"
          >
            <XCircle className="h-5 w-5 mr-2" />
            却下
            <kbd className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
              <ArrowLeft className="h-3 w-3 inline" />
            </kbd>
          </Button>

          {/* Skip */}
          <Button
            variant="outline"
            size="lg"
            onClick={handleSkip}
            className="h-14 px-6 text-muted-foreground hover:text-foreground transition-all"
          >
            <SkipForward className="h-5 w-5 mr-1" />
            <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
              <ArrowDown className="h-3 w-3 inline" />
            </kbd>
          </Button>

          {/* Approve */}
          <Button
            size="lg"
            onClick={handleApprove}
            className="flex-1 h-14 bg-emerald-600 hover:bg-emerald-700 text-white transition-all"
          >
            <CheckCircle className="h-5 w-5 mr-2" />
            承認
            <kbd className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-emerald-800 text-emerald-200 font-mono">
              <ArrowRight className="h-3 w-3 inline" />
            </kbd>
          </Button>
        </div>

        {/* Keyboard shortcut help */}
        <div className="mt-4 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Keyboard className="h-3 w-3 mr-0.5" />
          <kbd className="px-1 py-0.5 rounded bg-muted font-mono">r</kbd>
          <span>/</span>
          <kbd className="px-1 py-0.5 rounded bg-muted font-mono">
            <ArrowLeft className="h-2.5 w-2.5 inline" />
          </kbd>
          <span>却下</span>
          <span className="mx-1.5">|</span>
          <kbd className="px-1 py-0.5 rounded bg-muted font-mono">s</kbd>
          <span>/</span>
          <kbd className="px-1 py-0.5 rounded bg-muted font-mono">
            <ArrowDown className="h-2.5 w-2.5 inline" />
          </kbd>
          <span>スキップ</span>
          <span className="mx-1.5">|</span>
          <kbd className="px-1 py-0.5 rounded bg-muted font-mono">a</kbd>
          <span>/</span>
          <kbd className="px-1 py-0.5 rounded bg-muted font-mono">
            <ArrowRight className="h-2.5 w-2.5 inline" />
          </kbd>
          <span>承認</span>
          <span className="mx-1.5">|</span>
          <kbd className="px-1 py-0.5 rounded bg-muted font-mono">z</kbd>
          <span>元に戻す</span>
        </div>
      </main>

      {/* Undo toast */}
      {showUndoToast && undoStack.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card shadow-lg px-4 py-3">
            <span className="text-sm text-foreground">
              {undoStack[undoStack.length - 1].decision === 'approved'
                ? '承認しました'
                : '却下しました'}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleUndo}
              className="h-7 text-xs"
            >
              <Undo2 className="h-3 w-3 mr-1" />
              元に戻す
              <kbd className="ml-1 text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                z
              </kbd>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
