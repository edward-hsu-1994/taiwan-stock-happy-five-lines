import { describe, expect, it } from 'vitest'
import { calculateRelativeVolume, calculateRelativeStrengthIndex, RELATIVE_VOLUME_PERIOD, RSI_PERIOD } from './stocks'

describe('calculateRelativeStrengthIndex', () => {
  it('aligns values to closes and waits for fourteen price changes', () => {
    const prices = Array.from({ length: RSI_PERIOD + 1 }, (_, index) => 100 + index)
    const values = calculateRelativeStrengthIndex(prices)

    expect(values).toHaveLength(prices.length)
    expect(values.slice(0, RSI_PERIOD)).toEqual(Array(RSI_PERIOD).fill(null))
    expect(values[RSI_PERIOD]).toBe(100)
    expect(calculateRelativeStrengthIndex(prices.slice(0, RSI_PERIOD))).toEqual(Array(RSI_PERIOD).fill(null))
  })

  it('uses Wilder smoothing after the initial average', () => {
    const prices = Array.from({ length: RSI_PERIOD + 2 }, (_, index) => 100 + index)
    prices[prices.length - 1] -= 3

    const values = calculateRelativeStrengthIndex(prices)

    expect(values[RSI_PERIOD]).toBe(100)
    expect(values[RSI_PERIOD + 1]).toBeCloseTo(86.6667, 3)
    expect(values.every((value) => value === null || (value >= 0 && value <= 100))).toBe(true)
  })

  it('handles one-sided and unchanged price sequences', () => {
    const rising = Array.from({ length: RSI_PERIOD + 1 }, (_, index) => 100 + index)
    const falling = Array.from({ length: RSI_PERIOD + 1 }, (_, index) => 100 - index)
    const unchanged = Array.from({ length: RSI_PERIOD + 1 }, () => 100)

    expect(calculateRelativeStrengthIndex(rising)[RSI_PERIOD]).toBe(100)
    expect(calculateRelativeStrengthIndex(falling)[RSI_PERIOD]).toBe(0)
    expect(calculateRelativeStrengthIndex(unchanged)[RSI_PERIOD]).toBe(50)
  })
})

describe('calculateRelativeVolume', () => {
  it('compares current volume with the previous twenty sessions', () => {
    const previousVolumes = Array.from({ length: RELATIVE_VOLUME_PERIOD }, (_, index) => 100 + index)
    const volumes = [...previousVolumes, 120]
    const values = calculateRelativeVolume(volumes)

    expect(values).toHaveLength(volumes.length)
    expect(values.slice(0, RELATIVE_VOLUME_PERIOD)).toEqual(Array(RELATIVE_VOLUME_PERIOD).fill(null))
    expect(values[RELATIVE_VOLUME_PERIOD]).toBeCloseTo(120 / 109.5)
  })

  it('waits for twenty complete prior volume readings', () => {
    const volumes = [...Array.from({ length: RELATIVE_VOLUME_PERIOD }, (_, index) => index + 1), null, 21]
    const values = calculateRelativeVolume(volumes)

    expect(values[RELATIVE_VOLUME_PERIOD]).toBeNull()
    expect(values[RELATIVE_VOLUME_PERIOD + 1]).toBeCloseTo(21 / 10.5)
  })

  it('returns no ratio when the preceding average volume is zero', () => {
    const volumes = [...Array(RELATIVE_VOLUME_PERIOD).fill(0), 10]

    expect(calculateRelativeVolume(volumes).at(-1)).toBeNull()
  })
})
