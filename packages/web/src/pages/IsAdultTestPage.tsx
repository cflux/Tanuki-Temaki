import { useState } from 'react';

type IsAdultValue = 'omit' | 'true' | 'false';
type QueryType = 'searchMedia' | 'searchMediaMultiple' | 'getAnimeWithRelations' | 'searchByTag';

interface TestResult {
  queryType: QueryType;
  isAdultValue: IsAdultValue;
  resultCount: number;
  results: any[];
  error?: string;
  timestamp: Date;
}

export function IsAdultTestPage() {
  const [queryType, setQueryType] = useState<QueryType>('searchMedia');
  const [searchInput, setSearchInput] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [anilistId, setAnilistId] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<IsAdultValue, TestResult | null>>({
    omit: null,
    true: null,
    false: null,
  });

  const copyResultsAsText = () => {
    const lines: string[] = [];
    lines.push('=== AniList isAdult Parameter Test Results ===\n');
    lines.push(`Query Type: ${queryType}`);

    // Show the correct input based on query type
    if (queryType === 'searchMedia' || queryType === 'searchMediaMultiple') {
      lines.push(`Search: ${searchInput}`);
    } else if (queryType === 'searchByTag') {
      lines.push(`Tag: ${tagInput}`);
    } else if (queryType === 'getAnimeWithRelations') {
      lines.push(`AniList ID: ${anilistId}`);
    }
    lines.push('');

    const values: IsAdultValue[] = ['omit', 'true', 'false'];
    values.forEach(val => {
      const result = results[val];
      if (result) {
        lines.push(`\n--- isAdult: ${val} ---`);
        if (result.error) {
          lines.push(`Error: ${result.error}`);
        } else {
          lines.push(`Result Count: ${result.resultCount}`);
          if (result.results.length > 0) {
            lines.push('\nResults:');
            result.results.forEach((item, idx) => {
              const title = item.title?.english || item.title?.romaji || item.title;
              const id = item.id ? `(ID: ${item.id})` : '';
              const isAdult = item.isAdult !== undefined ? `isAdult: ${item.isAdult}` : '';
              const type = item._type ? `[${item._type}]` : '';
              lines.push(`  ${idx + 1}. ${title} ${id} ${type} ${isAdult}`.trim());
            });
          }
        }
      }
    });

    navigator.clipboard.writeText(lines.join('\n'));
  };

  const runTest = async (isAdultValue: IsAdultValue) => {
    setLoading(true);
    try {
      const response = await fetch('/api/test/isadult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queryType,
          isAdultValue,
          searchInput,
          tagInput,
          anilistId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      setResults(prev => ({
        ...prev,
        [isAdultValue]: {
          queryType,
          isAdultValue,
          resultCount: data.resultCount,
          results: data.results,
          timestamp: new Date(),
        },
      }));
    } catch (error) {
      setResults(prev => ({
        ...prev,
        [isAdultValue]: {
          queryType,
          isAdultValue,
          resultCount: 0,
          results: [],
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
        },
      }));
    } finally {
      setLoading(false);
    }
  };

  const runAllTests = async () => {
    await runTest('omit');
    await runTest('true');
    await runTest('false');
  };

  const clearResults = () => {
    setResults({ omit: null, true: null, false: null });
  };

  const getInputPlaceholder = () => {
    switch (queryType) {
      case 'searchMedia':
      case 'searchMediaMultiple':
        return 'Enter anime/manga title (e.g., "Mushoku Tensei")';
      case 'getAnimeWithRelations':
        return 'Enter AniList ID (e.g., "146065")';
      case 'searchByTag':
        return 'Enter tag/genre (e.g., "action")';
      default:
        return '';
    }
  };

  const needsInput = queryType === 'searchMedia' || queryType === 'searchMediaMultiple';
  const needsTag = queryType === 'searchByTag';
  const needsId = queryType === 'getAnimeWithRelations';

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">AniList isAdult Parameter Testing</h1>
        <p className="text-zinc-400 mb-8">
          Compare results with different isAdult parameter values to understand AniList's filtering behavior
        </p>

        {/* Test Configuration */}
        <div className="bg-zinc-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Test Configuration</h2>

          {/* Query Type Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Query Type</label>
            <select
              value={queryType}
              onChange={(e) => {
                setQueryType(e.target.value as QueryType);
                clearResults();
              }}
              className="w-full px-4 py-2 bg-zinc-700 border border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="searchMedia">searchMedia (single result)</option>
              <option value="searchMediaMultiple">searchMediaMultiple (multiple results)</option>
              <option value="getAnimeWithRelations">getAnimeWithRelations (with relations & recommendations)</option>
              <option value="searchByTag">searchByTag (tag/genre search)</option>
            </select>
          </div>

          {/* Input Field */}
          {needsInput && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Search Title</label>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={getInputPlaceholder()}
                className="w-full px-4 py-2 bg-zinc-700 border border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {needsTag && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Tag/Genre Name</label>
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder={getInputPlaceholder()}
                className="w-full px-4 py-2 bg-zinc-700 border border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {needsId && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">AniList ID</label>
              <input
                type="text"
                value={anilistId}
                onChange={(e) => setAnilistId(e.target.value)}
                placeholder={getInputPlaceholder()}
                className="w-full px-4 py-2 bg-zinc-700 border border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={runAllTests}
              disabled={loading || (!searchInput && needsInput) || (!tagInput && needsTag) || (!anilistId && needsId)}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            >
              {loading ? 'Running Tests...' : 'Run All Tests'}
            </button>
            <button
              onClick={clearResults}
              className="px-6 py-2 bg-zinc-600 hover:bg-zinc-700 rounded-lg font-medium transition-colors"
            >
              Clear Results
            </button>
            {(results.omit || results.true || results.false) && (
              <button
                onClick={copyResultsAsText}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors"
              >
                Copy Results as Text
              </button>
            )}
          </div>
        </div>

        {/* Results Comparison Table */}
        {(results.omit || results.true || results.false) && (
          <div className="bg-zinc-800 rounded-lg p-6 border border-zinc-700">
            <h2 className="text-xl font-semibold mb-4">Results Comparison</h2>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <SummaryCard title="isAdult: omitted" result={results.omit} />
              <SummaryCard title="isAdult: true" result={results.true} />
              <SummaryCard title="isAdult: false" result={results.false} />
            </div>

            {/* Detailed Results */}
            <div className="space-y-4">
              {['omit', 'true', 'false'].map(val => {
                const result = results[val as IsAdultValue];
                if (!result) return null;

                return (
                  <div key={val} className="border border-zinc-700 rounded-lg p-4">
                    <h3 className="font-semibold mb-2">
                      isAdult: {val}
                      <span className="ml-3 text-zinc-400">({result.resultCount} results)</span>
                    </h3>

                    {result.error ? (
                      <div className="text-red-400 text-sm">{result.error}</div>
                    ) : result.results.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                        {result.results.map((item, idx) => (
                          <div key={idx} className="text-sm bg-zinc-700/30 rounded p-2">
                            <div className="font-medium truncate">
                              {item.title?.english || item.title?.romaji || item.title}
                            </div>
                            <div className="text-xs text-zinc-400 flex items-center gap-2 flex-wrap">
                              {item.id && (
                                <span className="font-mono bg-zinc-800 px-1 rounded">
                                  ID: {item.id}
                                </span>
                              )}
                              {item.isAdult !== undefined && (
                                <span className={item.isAdult ? 'text-red-400' : 'text-green-400'}>
                                  {item.isAdult ? '🔞' : '✓'}
                                </span>
                              )}
                              {item._type && <span className="text-blue-400">[{item._type}]</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-zinc-500 text-sm">No results</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface SummaryCardProps {
  title: string;
  result: TestResult | null;
}

function SummaryCard({ title, result }: SummaryCardProps) {
  if (!result) {
    return (
      <div className="bg-zinc-700/30 rounded-lg p-4 border border-zinc-600">
        <h3 className="text-sm font-semibold text-zinc-400 mb-2">{title}</h3>
        <div className="text-zinc-500 text-sm">Not tested</div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-700/30 rounded-lg p-4 border border-zinc-600">
      <h3 className="text-sm font-semibold text-zinc-300 mb-2">{title}</h3>
      {result.error ? (
        <div className="text-red-400 text-sm">Error: {result.error}</div>
      ) : (
        <div>
          <div className="text-3xl font-bold mb-1">{result.resultCount}</div>
          <div className="text-xs text-zinc-400">
            {result.resultCount === 1 ? 'result' : 'results'}
          </div>
          {result.results.length > 0 && result.results.some(r => r.isAdult !== undefined) && (
            <div className="mt-2 text-xs">
              <span className="text-green-400">
                {result.results.filter(r => !r.isAdult).length} safe
              </span>
              {' / '}
              <span className="text-red-400">
                {result.results.filter(r => r.isAdult).length} adult
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
