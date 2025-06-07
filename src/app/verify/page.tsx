"use client";

import { useState } from 'react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

// Define types for our verification API response
interface VerificationResult {
  verified: boolean;
  message: string;
  metadata?: {
    formId: string;
    responseId: string;
    timestamp: string;
  };
  storedAt?: string;
}

type VerificationMethod = 'hash' | 'content';

export default function VerifyPage() {
  const [verificationMethod, setVerificationMethod] = useState<VerificationMethod>('hash');
  const [hash, setHash] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedHash, setGeneratedHash] = useState<string | null>(null);

  // Function to create a deterministic hash from any input
  // Exactly matching the server-side implementation
  const generateDeterministicHash = async (input: unknown): Promise<string> => {
    try {
      // First, ensure we're working with the JSON representation
      // This is crucial for consistent hashing across client and server
      let jsonData: string;
      
      if (typeof input === 'string') {
        // If the input is already a string, try to parse it as JSON
        // If it's not valid JSON, just use the string as-is
        try {
          const parsed = JSON.parse(input);
          // Re-stringify with stable ordering
          jsonData = JSON.stringify(parsed, replacer);
        } catch (e) {
          console.log("e", e);
          // Not valid JSON, use as plain text
          jsonData = input;
        }
      } else {
        // For objects or other types, stringify with replacer function
        jsonData = JSON.stringify(input, replacer);
      }
      
      // Hash the prepared JSON string
      const encoder = new TextEncoder();
      const data = encoder.encode(jsonData);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      
      // Convert the hash to a hex string
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      return hashHex;
    } catch (err) {
      console.error('Error generating hash:', err);
      throw new Error('Failed to generate hash');
    }
  };
  
  // Replacer function for JSON.stringify that ensures deterministic output
  function replacer(key: string, value: unknown) {
    // Handle arrays to ensure consistent ordering
    if (Array.isArray(value)) {
      // Sort simple arrays by their string representation
      if (value.every(item => typeof item !== 'object' || item === null)) {
        return [...value].sort();
      }
      
      // For arrays of objects, sort by stringifying their contents
      return value
        .map(item => JSON.stringify(item, replacer))
        .sort()
        .map(item => {
          try {
            return JSON.parse(item);
          } catch (_error) {
            console.log("_error", _error);

            return item;
          }
        });
    }
    
    // Handle objects to ensure consistent key ordering
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value)
        .sort()
        .reduce((result: Record<string, unknown>, key) => {
          result[key] = (value as Record<string, unknown>)[key];
          return result;
        }, {});
    }
    
    return value;
  }

  const handleVerify = async () => {
    let hashToVerify: string;
    
    if (verificationMethod === 'hash') {
      if (!hash) {
        setError('Please enter a hash to verify');
        return;
      }
      hashToVerify = hash;
    } else {
      if (!content) {
        setError('Please enter content to hash and verify');
        return;
      }
      
      try {
        // Parse content accordingly
        let contentValue: unknown;
        try {
          contentValue = JSON.parse(content);
        } catch (_e) {
          console.log("", _e);

          // Not valid JSON, use as plain text
          contentValue = content;
        }
        
        // Generate hash from content using our deterministic algorithm
        hashToVerify = await generateDeterministicHash(contentValue);
        console.log("Generated hash from content:", hashToVerify);
        console.log("Original content:", content);
        setGeneratedHash(hashToVerify);
      } catch (err) {
        setError('Failed to generate hash from content');
        console.log(err);
        return;
      }
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log("Verifying hash:", hashToVerify);
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ hash: hashToVerify }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Verification API error:", errorText);
        throw new Error("The hash could not be verified");
      }
      
      const data = await response.json();
      setResult(data);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <main className="flex flex-col items-center justify-center min-h-[70vh]">
        <h1 className="text-3xl font-bold mb-8 text-center text-[#4285F4]">
          Adaverc Dataset Verification
        </h1>

        <div className="w-full max-w-lg">
          <div className="bg-white shadow-md rounded-lg p-6 border border-gray-200">
            <div className="border-l-4 border-[#4285F4] pl-3 mb-6">
              <h2 className="text-xl font-semibold text-[#202124]">Verify Dataset </h2>
              <p className="text-sm text-gray-500">Check research data validity&apos;s using blockchain</p>
            </div>
            
            {/* Verification Method Selector */}
            <div className="mb-6">
              <div className="flex border border-gray-300 rounded-md overflow-hidden">
                <button
                  onClick={() => setVerificationMethod('hash')}
                  className={`flex-1 py-2 px-4 text-sm font-medium ${
                    verificationMethod === 'hash'
                      ? 'bg-[#4285F4] text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Verify with Hash
                </button>
                <button
                  onClick={() => setVerificationMethod('content')}
                  className={`flex-1 py-2 px-4 text-sm font-medium ${
                    verificationMethod === 'content'
                      ? 'bg-[#4285F4] text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Hash & Verify Content
                </button>
              </div>
            </div>
            
            {/* Hash Input */}
            {verificationMethod === 'hash' && (
              <div className="mb-4">
                <label htmlFor="hash" className="block text-sm font-medium text-gray-700 mb-1">
                  Response Hash:
                </label>
                <input
                  type="text"
                  id="hash"
                  value={hash}
                  onChange={(e) => setHash(e.target.value)}
                  placeholder="Enter the SHA-256 hash"
                  className="w-full text-black px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#4285F4] focus:border-[#4285F4]"
                />
              </div>
            )}
            
            {/* Content Input */}
            {verificationMethod === 'content' && (
              <div className="mb-4">
                <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
                  Response Content:
                </label>
                <textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter the content to hash (JSON or text)"
                  rows={5}
                  className="w-full text-black px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#4285F4] focus:border-[#4285F4]"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Note: Enter either valid JSON or plain text.
                </p>
              </div>
            )}
            
            {/* Verify Button */}
            <button
              onClick={handleVerify}
              disabled={loading}
              className="w-full bg-[#4285F4] text-white py-2 px-4 rounded-md hover:bg-[#366ac7] focus:outline-none focus:ring-2 focus:ring-[#4285F4] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <LoadingSpinner className="mr-2 h-4 w-4" />
                  Verifying...
                </span>
              ) : (
                'Verify'
              )}
            </button>
            
            {/* Show Generated Hash (Content Mode) */}
            {verificationMethod === 'content' && generatedHash && (
              <div className="mt-4 p-3 bg-[#e8f0fe] border-l-4 border-[#4285F4] rounded-md">
                <h4 className="text-sm font-medium text-gray-700">Generated Hash:</h4>
                <p className="mt-1 text-xs font-mono break-all text-gray-600">{generatedHash}</p>
              </div>
            )}
            
            {/* Error Display */}
            {error && (
              <div className="mt-4 p-3 bg-red-50 border-l-4 border-red-400 rounded-md text-red-700">
                {error}
              </div>
            )}
            
            {/* Result Display */}
            {result && (
              <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-md">
                <h3 className={`text-lg font-medium ${result.verified ? 'text-green-600' : 'text-red-600'}`}>
                  {result.verified ? '✅ Verified' : '❌ Not Verified'}
                </h3>
                <p className="mt-2 text-gray-700">{result.message}</p>
                
                {result.verified && result.metadata && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-2 text-sm">
                      <span className="font-semibold text-gray-600">Form ID:</span>
                      <span className="text-gray-700">{result.metadata.formId}</span>
                      
                      <span className="font-semibold text-gray-600">Response ID:</span>
                      <span className="text-gray-700">{result.metadata.responseId}</span>
                      
                      <span className="font-semibold text-gray-600">Timestamp:</span>
                      <span className="text-gray-700">{new Date(result.metadata.timestamp).toLocaleString()}</span>
                      
                      {result.storedAt && (
                        <>
                          <span className="font-semibold text-gray-600">Stored:</span>
                          <span className="text-gray-700">{new Date(result.storedAt).toLocaleString()}</span>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-8 text-center text-sm text-gray-500">
          <div className="flex items-center justify-center">
                   <p>Powered by Cardano blockchain technology</p>
          </div>
        </div>
      </main>
    </div>
  );
}