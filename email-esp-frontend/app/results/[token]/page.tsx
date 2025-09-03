'use client';

import { useParams } from 'next/navigation';
import { useTestStatus } from '../../../hooks/useTestStatus';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { ESPBadge } from '../../../components/ui/ESPBadge';
import { ReceivingChainTimeline } from '../../../components/ReceivingChainTimeline';
import { Section } from '../../../components/ui/Section';
import { Skeleton, SkeletonText } from '../../../components/Skeleton';
import { buildHomeWithToken } from '../../../lib/url';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function ResultsPage() {
  const params = useParams();
  const token = params.token as string;
  
  const { data: testSession, isLoading, error } = useTestStatus(token);

  const handleCopyRawJSON = async () => {
    if (!testSession) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(testSession, null, 2));
      toast.success('Raw JSON copied to clipboard!');
    } catch {
      toast.error('Failed to copy JSON');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">Loading test result...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <div className="bg-red-50 border border-red-200 rounded-md p-6">
              <h2 className="text-lg font-medium text-red-900 mb-2">Error Loading Result</h2>
              <p className="text-red-700 mb-4">{error}</p>
              <Link
                href={buildHomeWithToken(token)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Go to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!testSession) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Test Result</h1>
            <p className="text-gray-600">No test data found for this token.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Test Result</h1>
        </div>

        <Section title="Test Status" description="Current status of the email test">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">Status:</span>
              {isLoading ? (
                <Skeleton className="h-6 w-20" />
              ) : (
                <StatusBadge status={testSession.status as 'waiting' | 'received' | 'parsed' | 'error'} />
              )}
            </div>

            {isLoading ? (
              <div className="space-y-4">
                <SkeletonText lines={2} />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : testSession.status === 'parsed' ? (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">Detected ESP:</span>
                  <ESPBadge esp={testSession.esp || 'Unknown'} />
                </div>

                {(testSession.receivingChain && testSession.receivingChain.length > 0) ? (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Email Journey</h4>
                    <ReceivingChainTimeline chain={testSession.receivingChain} />
                  </div>
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                    <p className="text-sm text-yellow-800">
                      We couldn&apos;t parse any &apos;Received&apos; headers from this message. Try sending from a different ESP or check raw headers.
                    </p>
                    {/* TODO: Add "Show Raw Headers" collapsible when backend supplies raw headers */}
                  </div>
                )}

                <div className="pt-4 border-t border-gray-200">
                  <button
                    onClick={handleCopyRawJSON}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-md transition-colors"
                  >
                    Copy Raw JSON
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-600 mb-4">
                  Test is still in progress. Visit the home page to see live updates.
                </p>
                <Link
                  href={buildHomeWithToken(token)}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Go to Home
                </Link>
              </div>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}
