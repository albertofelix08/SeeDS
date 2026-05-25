// =============================================================
//  SeeDS — confidenceScorer.js
//  Scores confidence in the analysis based on token count,
//  parse quality, struct match strength, and error detection.
// =============================================================

import { DS_TYPES } from '../core/constants.js';


class ConfidenceScorer {
  constructor(tokenResult, parseResult, structResult) {
    this._tokenResult  = tokenResult;
    this._parseResult  = parseResult;
    this._structResult = structResult;
  }


  /**
   * Compute confidence score and breakdown.
   */
  compute() {
    const breakdown = {};

    // ---- 1. Token quality (10%) ----
    breakdown.tokenQuality = this._scoreTokenQuality();
    const tokenWeight = 0.10;

    // ---- 2. Parse success (20%) ----
    breakdown.parseQuality = this._scoreParseQuality();
    const parseWeight = 0.20;

    // ---- 3. Structure detection (40%) ----
    breakdown.structQuality = this._scoreStructQuality();
    const structWeight = 0.40;

    // ---- 4. Error detection quality (10%) ----
    breakdown.errorQuality = this._scoreErrorQuality();
    const errorWeight = 0.10;

    // ---- 5. Function completeness (20%) ----
    breakdown.funcQuality = this._scoreFuncQuality();
    const funcWeight = 0.20;

    const total =
      breakdown.tokenQuality * tokenWeight +
      breakdown.parseQuality * parseWeight +
      breakdown.structQuality * structWeight +
      breakdown.errorQuality * errorWeight +
      breakdown.funcQuality * funcWeight;

    const score = Math.round(total * 100);

    return {
      score,
      percent: Math.min(100, Math.max(0, score)),
      breakdown,
      level: this._levelFromScore(score),
    };
  }


  _scoreTokenQuality() {
    const { tokens, sourceLineCount } = this._tokenResult;
    const meaningfulTokens = tokens.filter(t =>
      t.type !== 'eof' && t.type !== 'whitespace' && t.type !== 'newline'
    ).length;

    // Need at least 5 meaningful tokens to be valid
    if (meaningfulTokens < 5) return 0;
    if (meaningfulTokens < 20) return 0.3;
    if (meaningfulTokens < 50) return 0.6;
    if (meaningfulTokens < 200) return 0.9;
    return 1.0;
  }


  _scoreParseQuality() {
    const { structs, functions, errors } = this._parseResult;

    // Penalize parse errors
    const parseErrorPenalty = errors.length > 0 ? Math.max(0, 1 - errors.length * 0.2) : 1.0;

    // Reward struct detection
    const structBonus = structs.length > 0 ? 0.3 : 0;
    const funcBonus = functions.length > 0 ? 0.3 : 0;

    return Math.min(1.0, (parseErrorPenalty * 0.4) + structBonus + funcBonus);
  }


  _scoreStructQuality() {
    const structResult = this._structResult;
    if (!structResult) return 0;

    const { confidence, score, type } = structResult;

    // Normalize: max expected score is ~100
    return Math.min(1.0, Math.max(0, score / 80));
  }


  _scoreErrorQuality() {
    const { structs, functions } = this._parseResult;

    // Better scores if we have actual code to analyze
    if (structs.length === 0 && functions.length === 0) return 0;

    // More code = more thorough analysis
    if (functions.length > 3) return 1.0;
    if (functions.length > 1) return 0.7;
    if (functions.length > 0) return 0.4;
    return 0.2;
  }


  _scoreFuncQuality() {
    const { functions } = this._parseResult;
    if (functions.length === 0) return 0;

    // Count functions with bodies
    const withBodies = functions.filter(f => f.bodyTokens && f.bodyTokens.length > 5);
    if (withBodies.length === 0) return 0.1;

    const ratio = withBodies.length / functions.length;
    return Math.min(1.0, ratio * 0.5 + Math.min(1.0, functions.length / 5) * 0.5);
  }


  _levelFromScore(score) {
    if (score >= 85) return 'excellent';
    if (score >= 65) return 'good';
    if (score >= 40) return 'fair';
    return 'poor';
  }
}


/**
 * Create and compute a confidence score.
 */
export function score(tokenResult, parseResult, structResult) {
  const scorer = new ConfidenceScorer(tokenResult, parseResult, structResult);
  return scorer.compute();
}
