'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CheckCircle, XCircle, SkipForward, Clock } from 'lucide-react';

interface SessionStats {
  approved: number;
  rejected: number;
  skipped: number;
}

interface CurationStatsProps {
  sessionStats: SessionStats;
}

export default function CurationStats({ sessionStats }: CurationStatsProps) {
  const [candidateCount, setCandidateCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const candidateQuery = query(
          collection(db, 'products'),
          where('status', '==', 'candidate')
        );
        const candidateSnapshot = await getCountFromServer(candidateQuery);
        setCandidateCount(candidateSnapshot.data().count);
      } catch (error) {
        console.error('Error fetching curation stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCounts();
  }, [sessionStats]);

  const totalReviewed = sessionStats.approved + sessionStats.rejected;
  const approvalRate =
    totalReviewed > 0
      ? Math.round((sessionStats.approved / totalReviewed) * 100)
      : 0;

  return (
    <div className="flex flex-wrap items-center gap-4 text-sm">
      {/* Remaining candidates */}
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>
          残り:{' '}
          {loading ? (
            <span className="inline-block w-8 h-4 bg-muted animate-pulse rounded" />
          ) : (
            <span className="font-semibold text-foreground">
              {candidateCount?.toLocaleString() ?? '---'}
            </span>
          )}
        </span>
      </div>

      {/* Session: approved */}
      <div className="flex items-center gap-1.5 text-emerald-500">
        <CheckCircle className="h-4 w-4" />
        <span className="font-semibold">{sessionStats.approved}</span>
      </div>

      {/* Session: rejected */}
      <div className="flex items-center gap-1.5 text-red-500">
        <XCircle className="h-4 w-4" />
        <span className="font-semibold">{sessionStats.rejected}</span>
      </div>

      {/* Session: skipped */}
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <SkipForward className="h-4 w-4" />
        <span className="font-semibold">{sessionStats.skipped}</span>
      </div>

      {/* Approval rate */}
      {totalReviewed > 0 && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span>承認率:</span>
          <span className="font-semibold text-foreground">{approvalRate}%</span>
        </div>
      )}
    </div>
  );
}
