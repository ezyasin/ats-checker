'use client';

import { useMemo, useEffect } from 'react';

interface CVDiffViewerProps {
  original: string;
  improved: string;
}

function getLinesDiff(original: string, improved: string) {
  // Handle edge cases
  if (!original || !improved) {
    return [];
  }
  
  const origLines = original.split('\n');
  const improvLines = improved.split('\n');

  const diffs = [];
  const maxLen = Math.max(origLines.length, improvLines.length);

  let origIdx = 0;
  let improveIdx = 0;

  while (origIdx < origLines.length || improveIdx < improvLines.length) {
    const origLine = origIdx < origLines.length ? origLines[origIdx] : null;
    const improveLine = improveIdx < improvLines.length ? improvLines[improveIdx] : null;

    if (origLine === improveLine) {
      diffs.push({ type: 'unchanged', content: origLine || '', origIdx: origIdx + 1, improveIdx: improveIdx + 1 });
      origIdx++;
      improveIdx++;
    } else if (!improveLine) {
      diffs.push({ type: 'removed', content: origLine || '', origIdx: origIdx + 1, improveIdx: -1 });
      origIdx++;
    } else if (!origLine) {
      diffs.push({ type: 'added', content: improveLine || '', origIdx: -1, improveIdx: improveIdx + 1 });
      improveIdx++;
    } else if (origLine && improveLine) {
      // Check if next lines match to find insertion point
      let foundMatch = false;
      for (let i = improveIdx + 1; i < Math.min(improveIdx + 5, improvLines.length); i++) {
        if (origLine === improvLines[i]) {
          // Lines were inserted
          for (let j = improveIdx; j < i; j++) {
            diffs.push({ type: 'added', content: improvLines[j], origIdx: -1, improveIdx: j + 1 });
          }
          improveIdx = i;
          foundMatch = true;
          break;
        }
      }
      if (!foundMatch) {
        // Line was modified
        diffs.push({ type: 'removed', content: origLine, origIdx: origIdx + 1, improveIdx: -1 });
        diffs.push({ type: 'added', content: improveLine, origIdx: -1, improveIdx: improveIdx + 1 });
        origIdx++;
        improveIdx++;
      }
    }
  }

  return diffs;
}

export function CVDiffViewer({ original, improved }: CVDiffViewerProps) {
  useEffect(() => {
    console.log('CVDiffViewer mounted with:', {
      originalLength: original?.length,
      improvedLength: improved?.length,
      originalPreview: original?.substring(0, 100),
      improvedPreview: improved?.substring(0, 100),
    });
  }, [original, improved]);

  if (!original || !improved) {
    return (
      <div className="text-center text-gray-500 py-8">
        Unable to display diff - missing original or improved CV text
      </div>
    );
  }

  const diffs = useMemo(() => getLinesDiff(original, improved), [original, improved]);

  const addedCount = diffs.filter(d => d.type === 'added').length;
  const removedCount = diffs.filter(d => d.type === 'removed').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded bg-green-500"></span>
          <span className="text-sm font-medium text-gray-700">{addedCount} additions</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded bg-red-500"></span>
          <span className="text-sm font-medium text-gray-700">{removedCount} deletions</span>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <div className="divide-y divide-gray-100">
          {diffs.slice(0, 100).map((diff, idx) => (
            <div
              key={idx}
              className={`flex font-mono text-sm ${
                diff.type === 'added'
                  ? 'bg-green-50 text-green-900'
                  : diff.type === 'removed'
                  ? 'bg-red-50 text-red-900'
                  : 'bg-white text-gray-800'
              }`}
            >
              <div className="flex-shrink-0 w-12 border-r border-gray-200 bg-gray-50 px-3 py-2 text-right text-xs text-gray-500">
                {diff.origIdx > 0 ? diff.origIdx : '-'}
              </div>
              <div className="flex-shrink-0 w-12 border-r border-gray-200 bg-gray-50 px-3 py-2 text-right text-xs text-gray-500">
                {diff.improveIdx > 0 ? diff.improveIdx : '-'}
              </div>
              <div className="flex-shrink-0 w-6 px-3 py-2 font-bold">
                {diff.type === 'added' && '+'}
                {diff.type === 'removed' && '−'}
                {diff.type === 'unchanged' && ' '}
              </div>
              <div className="flex-1 px-3 py-2 overflow-x-auto whitespace-pre-wrap break-words">
                {diff.content || '\x00'}
              </div>
            </div>
          ))}
        </div>

        {diffs.length > 100 && (
          <div className="p-4 text-center text-sm text-gray-600 bg-gray-50 border-t border-gray-200">
            Showing first 100 changes ({diffs.length} total)
          </div>
        )}
      </div>
    </div>
  );
}
