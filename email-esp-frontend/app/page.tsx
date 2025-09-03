'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { startTest, getTestStatus, resetTest } from '../lib/api';
import { ReceivingChainTimeline } from '../components/ReceivingChainTimeline';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ESPBadge } from '../components/ui/ESPBadge';
import { CopyField } from '../components/ui/CopyField';
import { Section } from '../components/ui/Section';
import { Skeleton, SkeletonText } from '../components/Skeleton';
import { Modal } from '../components/Modal';
import toast from 'react-hot-toast';

interface TestSession {
  status: string;
  subject: string;
  emailId?: string;
  esp?: string;
  receivingChain?: Array<{
    by: string;
    from: string;
    with?: string;
    id?: string;
    for?: string;
    timestamp?: string;
    ip?: string;
  }>;
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [testSession, setTestSession] = useState<TestSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  const handleStartTest = async () => {
    setLoading(true);
    
    try {
      const result = await startTest();
      const token = result.subject.replace('LG-TEST-', '');
      setTestSession({ status: 'waiting', subject: result.subject });
      
      // Update URL with token
      router.push(`?token=${token}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start test';
      console.error('Start test error:', err);
      toast.error(`Start test error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // Hydrate from URL token on mount
  useEffect(() => {
    const token = searchParams.get('token');
    if (token && !testSession) {
      setInitialLoading(true);
      setTestSession({ status: 'waiting', subject: `LG-TEST-${token}` });
    }
  }, [searchParams, testSession]);

  // Polling effect
  useEffect(() => {
    if (!testSession || testSession.status === 'parsed' || testSession.status === 'error') {
      return;
    }

    const pollStatus = async () => {
      try {
        const token = testSession.subject.replace('LG-TEST-', '');
        const status = await getTestStatus(token);
        setTestSession(status);
        setInitialLoading(false);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to get test status';
        console.error('Polling error:', err);
        toast.error(`Polling error: ${errorMessage}`);
        setInitialLoading(false);
      }
    };

    const interval = setInterval(pollStatus, 3000);
    return () => clearInterval(interval);
  }, [testSession]);

  const handleCopyRawJSON = async () => {
    if (!testSession) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(testSession, null, 2));
      toast.success('Raw JSON copied to clipboard!');
    } catch {
      toast.error('Failed to copy JSON');
    }
  };

  const handleOpenShareableResult = () => {
    const token = testSession?.subject.replace('LG-TEST-', '');
    if (token) {
      const url = `${window.location.origin}?token=${token}`;
      window.open(url, '_blank');
    }
  };

  const handleResetTest = () => {
    setTestSession(null);
    setInitialLoading(false);
    router.push('/');
  };

  const handleResetCurrentTest = async () => {
    if (!testSession) return;
    
    try {
      const token = testSession.subject.replace('LG-TEST-', '');
      const result = await resetTest(token);
      setTestSession({ status: 'waiting', subject: result.subject });
      toast.success('Test reset successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reset test';
      toast.error(`Reset error: ${errorMessage}`);
    }
  };

  const handleRefreshStatus = async () => {
    if (!testSession) return;
    
    try {
      const token = testSession.subject.replace('LG-TEST-', '');
      const status = await getTestStatus(token);
      setTestSession(status);
      toast.success('Status refreshed');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh status';
      toast.error(`Refresh error: ${errorMessage}`);
    }
  };

  const inboxEmail = process.env.NEXT_PUBLIC_INBOX_EMAIL;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Email ESP Tester
          </h1>
          <p className="text-gray-600">
            Test email delivery and analyze ESP routing
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Test Setup Card */}
          <Section title="Test Setup" description="Start a new email test and get instructions">
            <div className="space-y-6">
              <button
                onClick={handleStartTest}
                disabled={loading || (testSession ? (testSession.status !== 'parsed' && testSession.status !== 'error') : false)}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-md transition-colors"
              >
                {loading ? 'Starting...' : 'Start Test'}
              </button>

              {testSession && (
                <div className="space-y-4">
                  <div>
                    <CopyField
                      label="Send test email TO"
                      value={inboxEmail || 'Set NEXT_PUBLIC_INBOX_EMAIL'}
                    />
                    {!inboxEmail && (
                      <div className="mt-2 text-sm text-amber-600">
                        <span>Environment variable not configured. </span>
                        <button
                          onClick={() => setShowConfigModal(true)}
                          className="text-amber-700 underline hover:text-amber-800"
                        >
                          Configure
                        </button>
                      </div>
                    )}
                  </div>
                  <CopyField
                    label="Use EXACT SUBJECT"
                    value={testSession.subject}
                  />
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                    <h4 className="text-sm font-medium text-blue-900 mb-2">Instructions:</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Send an email from any account to the above address.</li>
                      <li>• Keep this page open; status will update automatically.</li>
                      <li>• We analyze only the FIRST email matching the subject.</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* Live Status Card */}
          <Section title="Live Status" description="Real-time test progress and results">
            <div className="space-y-6">
              {testSession ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-700">Status:</span>
                      {initialLoading ? (
                        <Skeleton className="h-6 w-20" />
                      ) : (
                        <StatusBadge status={testSession.status as 'waiting' | 'received' | 'parsed' | 'error'} />
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleRefreshStatus}
                        className="px-3 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md transition-colors"
                        title="Refresh status"
                      >
                        Refresh
                      </button>
                      <button
                        onClick={handleResetTest}
                        className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
                        title="Start new test"
                      >
                        New Test
                      </button>
                    </div>
                  </div>

                  {initialLoading ? (
                    <div className="space-y-4">
                      <SkeletonText lines={2} />
                      <Skeleton className="h-32 w-full" />
                    </div>
                  ) : (
                    <>
                      {testSession.status === 'waiting' && (
                        <div className="flex items-center gap-3 text-gray-600">
                          <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                          <span className="text-sm">Waiting for email…</span>
                        </div>
                      )}

                      {testSession.status === 'received' && (
                        <div className="text-sm text-gray-600">
                          Email received! Parsing headers…
                        </div>
                      )}

                      {testSession.status === 'parsed' && (
                        <div className="space-y-4">
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

                          <div className="flex gap-3 pt-4 border-t border-gray-200">
                            <button
                              onClick={handleCopyRawJSON}
                              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-md transition-colors text-sm"
                            >
                              Copy Raw JSON
                            </button>
                            <button
                              onClick={handleOpenShareableResult}
                              className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-700 font-medium py-2 px-4 rounded-md transition-colors text-sm"
                            >
                              Open Shareable Result
                            </button>
                          </div>
                        </div>
                      )}

                      {testSession.status === 'error' && (
                        <div className="bg-red-50 border border-red-200 rounded-md p-4">
                          <div className="text-sm text-red-800">
                            <p className="font-medium mb-2">Test failed or timed out</p>
                            <p className="mb-3">This usually happens when:</p>
                            <ul className="list-disc list-inside space-y-1 mb-3">
                              <li>No email was sent with the exact subject</li>
                              <li>The email took too long to arrive</li>
                              <li>There was a connection issue</li>
                            </ul>
                            <div className="flex gap-2">
                              <button
                                onClick={handleRefreshStatus}
                                className="px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded-md transition-colors"
                              >
                                Check Again
                              </button>
                              <button
                                onClick={handleResetCurrentTest}
                                className="px-3 py-1 text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded-md transition-colors"
                              >
                                Reset Test
                              </button>
                              <button
                                onClick={handleResetTest}
                                className="px-3 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md transition-colors"
                              >
                                New Test
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <p className="text-sm">Start a test to see live status updates</p>
                </div>
              )}
            </div>
          </Section>
        </div>
      </div>

      {/* Configuration Modal */}
      <Modal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        title="Environment Configuration"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            To configure the inbox email address, you need to set the environment variable:
          </p>
          <div className="bg-gray-100 p-3 rounded-md">
            <code className="text-sm font-mono">NEXT_PUBLIC_INBOX_EMAIL</code>
          </div>
          <div className="text-sm text-gray-600">
            <p className="font-medium mb-2">Where to change environment variables:</p>
            <ul className="space-y-1 text-sm">
              <li>• <strong>Vercel:</strong> Project → Settings → Environment Variables</li>
              <li>• <strong>Netlify:</strong> Site Settings → Environment Variables</li>
              <li>• <strong>Local development:</strong> Create a <code>.env.local</code> file</li>
            </ul>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
