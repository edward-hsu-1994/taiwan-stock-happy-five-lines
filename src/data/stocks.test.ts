import { describe, expect, it } from 'vitest'
import {
  calculateFiveLines,
  calculateLohuoChannel,
  calculateLohuoChannelSeries,
  resolveDateWindow,
  type CalculationWindow,
} from './stocks'

describe('calculateFiveLines', () => {
  it('fits a linear trend with rSquared ≈ 1 on a noisy-but-trending series', () => {
    // y = 5 + 2x with small noise so residuals are nonzero (avoid the deviation-fallback branch).
    const prices = Array.from({ length: 30 }, (_, index) => 5 + 2 * index + Math.sin(index) * 0.5)
    const result = calculateFiveLines(prices)
    // rSquared should be very close to 1
    expect(result.rSquared).toBeGreaterThan(0.99)
    // Middle (TL, index 2) is the regression line's last value
    expect(result.lines[2]).toBeCloseTo(5 + 2 * 29, 0)
    // Five lines should be monotonically increasing across offsets [-2,-1,0,1,2]
    for (let index = 1; index < result.lines.length; index += 1) {
      expect(result.lines[index]).toBeGreaterThanOrEqual(result.lines[index - 1])
    }
  })

  it('handles constant series (rSquared=0; deviation uses yMean*0.05 fallback)', () => {
    // Constant series: residuals = 0, so Math.sqrt(0) = 0, then `|| yMean*0.05` short-circuits to fallback.
    // The fallback only matters when residuals are exactly 0; this documents the current behavior.
    const prices = [50, 50, 50, 50, 50]
    const result = calculateFiveLines(prices)
    expect(result.rSquared).toBe(0)
    const lastIndex = prices.length - 1
    // Deviation fallback: 50 * 0.05 = 2.5
    expect(result.trendLines[0][lastIndex]).toBeCloseTo(Math.max(0, 50 - 2 * 2.5), 12)
    expect(result.trendLines[1][lastIndex]).toBeCloseTo(Math.max(0, 50 - 1 * 2.5), 12)
    expect(result.trendLines[2][lastIndex]).toBeCloseTo(50, 12)
    expect(result.trendLines[3][lastIndex]).toBeCloseTo(50 + 1 * 2.5, 12)
    expect(result.trendLines[4][lastIndex]).toBeCloseTo(50 + 2 * 2.5, 12)
    expect(result.lines[0]).toBeCloseTo(Math.max(0, 50 - 2 * 2.5), 12)
    expect(result.lines[2]).toBeCloseTo(50, 12)
    expect(result.lines[4]).toBeCloseTo(50 + 5, 12)
  })

  it('documents the deviation fallback quirk on a perfectly linear series', () => {
    // A mathematically perfect linear series y = 5 + 2x has residuals = 0, so the implementation's
    // `Math.sqrt(...) || yMean * 0.05` short-circuits to the 5% fallback. This test pins that
    // current behavior so any future fix is intentional.
    const prices = Array.from({ length: 10 }, (_, index) => 5 + 2 * index)
    const result = calculateFiveLines(prices)
    // rSquared is still 1 because totalVariance is nonzero
    expect(result.rSquared).toBeCloseTo(1, 12)
    // TL line at last index = 23
    expect(result.lines[2]).toBeCloseTo(23, 12)
    // Offsets ±k*0.7 around TL (yMean * 0.05 = 14 * 0.05 = 0.7)
    expect(result.lines[0]).toBeCloseTo(Math.max(0, 23 - 1.4), 12)
    expect(result.lines[4]).toBeCloseTo(23 + 1.4, 12)
  })

  it('returns five zero lines for an empty array', () => {
    const result = calculateFiveLines([])
    expect(result.lines).toEqual([0, 0, 0, 0, 0])
    expect(result.trendLines).toHaveLength(5)
    expect(result.trendLines.every((line) => line.length === 0)).toBe(true)
    expect(result.rSquared).toBe(0)
    expect(result.cv).toBe(0)
  })

  it('returns sane values for a single point', () => {
    const result = calculateFiveLines([42])
    expect(result.trendLines[2]).toEqual([42])
    expect(result.trendLines[0][0]).toBeCloseTo(Math.max(0, 42 - 4.2), 12)
    expect(result.trendLines[4][0]).toBeCloseTo(42 + 4.2, 12)
    expect(result.rSquared).toBe(0)
  })

  it('trend line values are clamped at Math.max(0, fitted ± k·deviation)', () => {
    const zeroResult = calculateFiveLines([0, 0, 0, 0, 0])
    for (const line of zeroResult.trendLines) {
      for (const value of line) {
        expect(value).toBeGreaterThanOrEqual(0)
      }
    }
    const declining = Array.from({ length: 20 }, (_, index) => 1 - index * 0.1)
    const result = calculateFiveLines(declining)
    for (const line of result.trendLines) {
      for (const value of line) {
        expect(value).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('rSquared is between 0 and 1 and lower for noisier series', () => {
    const clean = Array.from({ length: 30 }, (_, index) => 100 + index)
    const noisy = clean.map((value, index) => value + ((index % 2) ? 5 : -5))
    const cleanResult = calculateFiveLines(clean)
    const noisyResult = calculateFiveLines(noisy)
    expect(cleanResult.rSquared).toBeGreaterThanOrEqual(0)
    expect(cleanResult.rSquared).toBeLessThanOrEqual(1)
    expect(noisyResult.rSquared).toBeGreaterThanOrEqual(0)
    expect(noisyResult.rSquared).toBeLessThanOrEqual(1)
    expect(cleanResult.rSquared).toBeGreaterThanOrEqual(noisyResult.rSquared)
  })
})

describe('calculateLohuoChannel', () => {
  it('matches hand-calculated values for [1,2,3,4,5] with period=3', () => {
    // last 3 of [1,2,3,4,5] = [3,4,5]; mean=4; variance=((3-4)^2+(4-4)^2+(5-4)^2)/3=2/3
    const result = calculateLohuoChannel([1, 2, 3, 4, 5], 3)
    const expectedDeviation = Math.sqrt(2 / 3)
    expect(result.middle).toBeCloseTo(4, 12)
    // deviation = (upper - middle) / 2
    const derivedDeviation = (result.upper - result.middle) / 2
    expect(derivedDeviation).toBeCloseTo(expectedDeviation, 12)
    expect(result.upper).toBeCloseTo(4 + 2 * expectedDeviation, 12)
    expect(result.lower).toBeCloseTo(Math.max(0, 4 - 2 * expectedDeviation), 12)
    expect(result.period).toBe(3)
    const width = result.upper - result.lower
    expect(result.percentB).toBeCloseTo((5 - result.lower) / width, 12)
    expect(result.bandwidth).toBeCloseTo(width / 4, 12)
  })

  it('uses the full array when period exceeds length', () => {
    const small = [2, 4, 6]
    const result = calculateLohuoChannel(small, 100)
    expect(result.period).toBe(3)
    expect(result.middle).toBeCloseTo(4, 12)
    // variance of [2,4,6] around mean 4 = ((2-4)^2 + 0 + (6-4)^2)/3 = 8/3
    const derivedDeviation = (result.upper - result.middle) / 2
    expect(derivedDeviation).toBeCloseTo(Math.sqrt(8 / 3), 12)
  })

  it('percentB returns 0.5 and bandwidth 0 when width is zero (constant series)', () => {
    const result = calculateLohuoChannel([5, 5, 5])
    expect(result.percentB).toBe(0.5)
    expect(result.bandwidth).toBe(0)
    expect(result.upper).toBeCloseTo(5, 12)
    expect(result.lower).toBeCloseTo(5, 12)
    expect(result.middle).toBeCloseTo(5, 12)
  })

  it('lower band is clamped at 0', () => {
    const prices = Array.from({ length: 20 }, (_, index) => 10 - index * 0.5)
    const result = calculateLohuoChannel(prices, 20)
    expect(result.lower).toBeGreaterThanOrEqual(0)
  })
})

describe('calculateLohuoChannelSeries', () => {
  it('output arrays match input length', () => {
    const prices = Array.from({ length: 50 }, (_, index) => 10 + Math.sin(index / 5))
    const series = calculateLohuoChannelSeries(prices, 10)
    expect(series.middle).toHaveLength(prices.length)
    expect(series.upper).toHaveLength(prices.length)
    expect(series.lower).toHaveLength(prices.length)
  })

  it('matches per-index hand calculation on the prefix window', () => {
    const prices = [3, 5, 2, 8, 6, 7, 9, 4, 5, 6, 8]
    const period = 4
    const series = calculateLohuoChannelSeries(prices, period)
    const sampleIndices = [0, 5, prices.length - 1]
    for (const index of sampleIndices) {
      const start = Math.max(0, index + 1 - period)
      const window = prices.slice(start, index + 1)
      const channel = calculateLohuoChannel(window, period)
      expect(series.middle[index]).toBeCloseTo(channel.middle, 12)
      expect(series.upper[index]).toBeCloseTo(channel.upper, 12)
      expect(series.lower[index]).toBeCloseTo(channel.lower, 12)
    }
  })

  it('lower band values stay non-negative', () => {
    const prices = Array.from({ length: 30 }, (_, index) => 10 + index * 0.1)
    const series = calculateLohuoChannelSeries(prices, 5)
    for (const value of series.lower) {
      expect(value).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('resolveDateWindow', () => {
  const dates = ['2024-01-01', '2024-02-01', '2024-03-01', '2024-04-01', '2024-05-01', '2024-06-01', '2024-07-01', '2024-08-01']

  it('returns null for empty dates', () => {
    const window: CalculationWindow = { id: 1, startDate: '2024-02-01', endDate: '2024-05-01' }
    expect(resolveDateWindow([], window)).toBeNull()
  })

  it('hits a fully-contained window exactly', () => {
    const window: CalculationWindow = { id: 1, startDate: '2024-02-01', endDate: '2024-05-01' }
    expect(resolveDateWindow(dates, window)).toEqual({ start: 1, end: 4 })
  })

  it('clamps start to 0 when the requested start is before the data begins', () => {
    const window: CalculationWindow = { id: 1, startDate: '2023-01-01', endDate: '2024-03-01' }
    expect(resolveDateWindow(dates, window)).toEqual({ start: 0, end: 2 })
  })

  it('returns null when start falls past the last available date', () => {
    const window: CalculationWindow = { id: 1, startDate: '2030-01-01', endDate: '2031-01-01' }
    expect(resolveDateWindow(dates, window)).toBeNull()
  })

  it('returns null when the resolved range has fewer than 3 entries', () => {
    const window: CalculationWindow = { id: 1, startDate: '2024-02-01', endDate: '2024-02-15' }
    expect(resolveDateWindow(dates, window)).toBeNull()
  })
})