import { describe, expect, it } from 'vitest'
import { calculateRelativeStrengthIndex, RSI_PERIOD } from './stocks'

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
