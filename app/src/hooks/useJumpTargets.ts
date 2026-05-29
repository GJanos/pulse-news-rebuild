import { useRef, useMemo } from 'react';
import type { GlobalHeadline } from '../types';
import type { VisibleBucket } from './useDigestPageData';

export type ListItem =
  | { key: '__global__'; type: 'global'; payload: GlobalHeadline[] }
  | { key: string; type: 'region'; payload: VisibleBucket };

/** Exported for unit testing. */
export function buildJumpIndex(
  visible: VisibleBucket[],
  globalHeadlines: GlobalHeadline[],
  hasGlobal: boolean,
): { listData: ListItem[]; indexMap: Map<string, number> } {
  const listData: ListItem[] = [];
  if (hasGlobal) listData.push({ key: '__global__', type: 'global', payload: globalHeadlines });
  for (const b of visible) listData.push({ key: b.region.region, type: 'region', payload: b });
  const indexMap = new Map(listData.map((it, i) => [it.key, i]));
  return { listData, indexMap };
}

export function useJumpTargets(
  visible: VisibleBucket[],
  globalHeadlines: GlobalHeadline[],
  hasGlobal: boolean,
) {
  const indexMapRef = useRef<Map<string, number>>(new Map());

  const listData = useMemo(() => {
    const { listData: data, indexMap } = buildJumpIndex(visible, globalHeadlines, hasGlobal);
    indexMapRef.current = indexMap;
    return data;
  }, [visible, globalHeadlines, hasGlobal]);

  return { listData, indexMapRef };
}
