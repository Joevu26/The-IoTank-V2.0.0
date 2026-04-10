/**
 * Cross-Verification Engine for Market Intelligence Signals
 * Implements source agreement analysis and confidence scoring
 */

import { MarketSignal } from '@/types';

export interface CrossVerificationResult {
  signalId: string;
  title: string;
  confirmedBy: number;
  totalSources: number;
  confidenceLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  confidenceScore: number;
  conflictingReports: string[];
  supportingSources: string[];
  verificationStatus: 'VERIFIED' | 'PARTIAL' | 'UNVERIFIED' | 'CONFLICTING';
  timeToVerification: number; // minutes from first report
}

export interface SourceAgreementMetrics {
  totalSignals: number;
  verifiedSignals: number;
  partiallyVerifiedSignals: number;
  unverifiedSignals: number;
  conflictingSignals: number;
  overallAgreementRate: number;
  averageTimeToVerification: number;
  mostReliableSources: { source: string; verificationCount: number; reliability: number }[];
}

/**
 * Group similar signals for cross-verification
 */
function groupSimilarSignals(signals: MarketSignal[]): Record<string, MarketSignal[]> {
  const groups: Record<string, MarketSignal[]> = {};
  
  signals.forEach(signal => {
    // Create a normalization key for similar content
    const normalizedTitle = signal.title
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
    
    // Extract key terms for grouping
    const keyTerms = normalizedTitle
      .split(' ')
      .filter(word => word.length > 3) // Filter out short words
      .slice(0, 5) // Take first 5 meaningful words
      .join(' ');
    
    const groupKey = keyTerms || normalizedTitle.substring(0, 50);
    
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(signal);
  });
  
  return groups;
}

/**
 * Calculate confidence based on source agreement
 */
function calculateSourceConfidence(signalGroup: MarketSignal[]): {
  confidenceScore: number;
  confidenceLevel: CrossVerificationResult['confidenceLevel'];
  verificationStatus: CrossVerificationResult['verificationStatus'];
  conflictingReports: string[];
} {
  const sourceCount = signalGroup.length;
  const uniqueSources = new Set(signalGroup.map(s => s.source).filter((s): s is string => !!s)).size;
  
  // Base confidence from number of sources
  let confidenceScore = 0;
  if (sourceCount >= 3) confidenceScore = 95;
  else if (sourceCount === 2) confidenceScore = 75;
  else if (sourceCount === 1) confidenceScore = 50;
  else confidenceScore = 25;
  
  // Boost confidence for multiple unique sources
  if (uniqueSources > 1) {
    confidenceScore += uniqueSources * 5;
  }
  
  // Check for conflicting information
  const conflictingReports: string[] = [];
  const sentimentMap = signalGroup.map(s => {
    const text = (s.title + ' ' + s.summary).toLowerCase();
    if (text.includes('increase') || text.includes('rise')) return 'bullish';
    if (text.includes('decrease') || text.includes('fall')) return 'bearish';
    return 'neutral';
  });
  
  const uniqueSentiments = new Set(sentimentMap);
  if (uniqueSentiments.size > 1) {
    confidenceScore -= 20;
    conflictingReports.push('Sentiment disagreement between sources');
  }
  
  // Determine confidence level
  let confidenceLevel: CrossVerificationResult['confidenceLevel'];
  if (confidenceScore >= 85) confidenceLevel = 'VERY_HIGH';
  else if (confidenceScore >= 70) confidenceLevel = 'HIGH';
  else if (confidenceScore >= 50) confidenceLevel = 'MEDIUM';
  else confidenceLevel = 'LOW';
  
  // Determine verification status
  let verificationStatus: CrossVerificationResult['verificationStatus'];
  if (sourceCount >= 3 && uniqueSources >= 2) verificationStatus = 'VERIFIED';
  else if (sourceCount >= 2) verificationStatus = 'PARTIAL';
  else if (conflictingReports.length > 0) verificationStatus = 'CONFLICTING';
  else verificationStatus = 'UNVERIFIED';
  
  return {
    confidenceScore: Math.max(0, Math.min(100, confidenceScore)),
    confidenceLevel,
    verificationStatus,
    conflictingReports
  };
}

/**
 * Perform cross-verification on all signals
 */
export function crossVerifySignals(signals: MarketSignal[]): CrossVerificationResult[] {
  const signalGroups = groupSimilarSignals(signals);
  const results: CrossVerificationResult[] = [];
  
  Object.entries(signalGroups).forEach(([, signalGroup]) => {
    if (signalGroup.length === 0) return;
    
    // Sort by timestamp to get the first report
    const sortedGroup = signalGroup.sort((a, b) => a.timestamp - b.timestamp);
    const firstSignal = sortedGroup[0];
    const lastSignal = sortedGroup[sortedGroup.length - 1];
    
    // Calculate time to verification (in minutes)
    const timeToVerification = (lastSignal.timestamp - firstSignal.timestamp) / (1000 * 60);
    
    // Calculate source confidence
    const confidenceAnalysis = calculateSourceConfidence(signalGroup);
    
    // Get supporting sources
    const supportingSources = Array.from(new Set(signalGroup.map(s => s.source).filter((s): s is string => !!s)));
    
    const result: CrossVerificationResult = {
      signalId: firstSignal.id,
      title: firstSignal.title,
      confirmedBy: signalGroup.length,
      totalSources: new Set(signalGroup.map(s => s.source).filter((s): s is string => !!s)).size,
      confidenceLevel: confidenceAnalysis.confidenceLevel,
      confidenceScore: confidenceAnalysis.confidenceScore,
      conflictingReports: confidenceAnalysis.conflictingReports,
      supportingSources,
      verificationStatus: confidenceAnalysis.verificationStatus,
      timeToVerification
    };
    
    results.push(result);
  });
  
  return results.sort((a, b) => b.confidenceScore - a.confidenceScore);
}

/**
 * Calculate overall source agreement metrics
 */
export function calculateSourceAgreementMetrics(
  verificationResults: CrossVerificationResult[]
): SourceAgreementMetrics {
  const totalSignals = verificationResults.length;
  const verifiedSignals = verificationResults.filter(r => r.verificationStatus === 'VERIFIED').length;
  const partiallyVerifiedSignals = verificationResults.filter(r => r.verificationStatus === 'PARTIAL').length;
  const unverifiedSignals = verificationResults.filter(r => r.verificationStatus === 'UNVERIFIED').length;
  const conflictingSignals = verificationResults.filter(r => r.verificationStatus === 'CONFLICTING').length;
  
  const overallAgreementRate = totalSignals > 0 ? (verifiedSignals + partiallyVerifiedSignals) / totalSignals * 100 : 0;
  
  const averageTimeToVerification = totalSignals > 0
    ? verificationResults.reduce((sum, r) => sum + r.timeToVerification, 0) / totalSignals
    : 0;
  
  // Calculate most reliable sources
  const sourceReliability = new Map<string, { count: number; totalConfidence: number }>();
  
  verificationResults.forEach(result => {
    result.supportingSources.forEach(source => {
      const current = sourceReliability.get(source) || { count: 0, totalConfidence: 0 };
      sourceReliability.set(source, {
        count: current.count + 1,
        totalConfidence: current.totalConfidence + result.confidenceScore
      });
    });
  });
  
  const mostReliableSources = Array.from(sourceReliability.entries())
    .map(([source, data]) => ({
      source,
      verificationCount: data.count,
      reliability: data.totalConfidence / data.count
    }))
    .sort((a, b) => b.reliability - a.reliability)
    .slice(0, 10);
  
  return {
    totalSignals,
    verifiedSignals,
    partiallyVerifiedSignals,
    unverifiedSignals,
    conflictingSignals,
    overallAgreementRate,
    averageTimeToVerification,
    mostReliableSources
  };
}

/**
 * Enhance signals with cross-verification data
 */
export function enhanceSignalsWithVerification(
  signals: MarketSignal[],
  verificationResults: CrossVerificationResult[]
): MarketSignal[] {
  const verificationMap = new Map(
    verificationResults.map(result => [result.signalId, result])
  );
  
  return signals.map(signal => {
    const verification = verificationMap.get(signal.id);
    if (!verification) return signal;
    
    return {
      ...signal,
      // Add verification metadata as additional properties
      verificationConfidence: verification.confidenceScore,
      verificationStatus: verification.verificationStatus,
      confirmedBySources: verification.confirmedBy,
      supportingSources: verification.supportingSources
    } as MarketSignal & {
      verificationConfidence: number;
      verificationStatus: string;
      confirmedBySources: number;
      supportingSources: string[];
    };
  });
}

/**
 * Get high-confidence verified signals
 */
export function getHighConfidenceSignals(
  verificationResults: CrossVerificationResult[],
  threshold: number = 75
): CrossVerificationResult[] {
  return verificationResults.filter(result => 
    result.confidenceScore >= threshold && 
    result.verificationStatus !== 'CONFLICTING'
  );
}

/**
 * Detect potential misinformation or conflicting reports
 */
export function detectConflictingReports(
  verificationResults: CrossVerificationResult[]
): CrossVerificationResult[] {
  return verificationResults.filter(result => 
    result.verificationStatus === 'CONFLICTING' || 
    result.conflictingReports.length > 0
  );
}
