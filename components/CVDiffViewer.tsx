'use client';

interface CVDiffViewerProps {
  original: string | null | undefined;
  improved: string | null | undefined;
}

function getLinesDiff(original: string, improved: string) {
  if (typeof original !== 'string' || typeof improved !== 'string') {
    return [];
  }

  const origLines = original.split('\n');
  const improvLines = improved.split('\n');

  const maxLen = Math.max(origLines.length, improvLines.length);
  const diffs: Array<{ type: 'added' | 'removed' | 'unchanged'; content: string; origIdx: number; improveIdx: number }> = [];

  for (let i = 0; i < maxLen; i++) {
    const origLine = origLines[i] ?? '';
    const improveLine = improvLines[i] ?? '';

    if (origLine === improveLine) {
      diffs.push({ type: 'unchanged', content: origLine, origIdx: i + 1, improveIdx: i + 1 });
    } else {
      if (origLine) {
        diffs.push({ type: 'removed', content: origLine, origIdx: i + 1, improveIdx: -1 });
      }
      if (improveLine) {
        diffs.push({ type: 'added', content: improveLine, origIdx: -1, improveIdx: i + 1 });
      }
    }

    if (diffs.length > 2000) {
      // Protect against extremely large diff objects that can crash browser rendering
      diffs.push({ type: 'unchanged', content: '...diff truncated for performance...', origIdx: -1, improveIdx: -1 });
      break;
    }
  }

  return diffs;
}

export function CVDiffViewer({ original, improved }: CVDiffViewerProps) {
  if (!original || !improved) {
    return (
      <div className="text-center text-gray-500 py-8">
        <p>Unable to display diff - missing CV text</p>
        <p className="text-xs mt-2">Original: {original ? 'Present' : 'Missing'} | Improved: {improved ? 'Present' : 'Missing'}</p>
      </div>
    );
  }

  if (typeof original !== 'string' || typeof improved !== 'string') {
    return (
      <div className="text-center text-red-500 py-8">
        <p>Error: Invalid CV data format</p>
      </div>
    );
  }

  let diffs: Array<{ type: string; content: string; origIdx: number; improveIdx: number }> = [];
  try {
    diffs = getLinesDiff(original, improved);
  } catch (err) {
    return (
      <div className="text-center text-red-500 py-8">
        <p>Error generating diff: {String(err)}</p>
      </div>
    );
  }

  if (!diffs || diffs.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        <p>No changes detected between original and improved CV</p>
      </div>
    );
  }

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

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white max-h-[600px] overflow-y-auto">
        <div className="divide-y divide-gray-100">
          {diffs.slice(0, 100).map((diff, idx) => (
            <div
              key={`${idx}-${diff.type}-${diff.origIdx}`}
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
                {diff.content || ''}
              </div>
            </div>
          ))}
        </div>

        {diffs.length > 100 && (
          <div className="p-4 text-center text-sm text-gray-600 bg-gray-50 border-t border-gray-200 sticky bottom-0">
            Showing first 100 changes ({diffs.length} total)
          </div>
        )}
      </div>
    </div>
  );
}
