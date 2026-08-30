export const ranges = { '近一個月': 22, '近三個月': 66, '近一年': 252, '近一年半': 378, '近三年': 756, '近五年': 1260 } as const
export const calculationPeriods = { '近一個月': 22, '近三個月': 66, '近一年': 252, '近一年半': 378, '近三年': 756 } as const
export const comparisonColors = ['#5778a4', '#8f63a9', '#2f9c95', '#c48a32', '#c45b72', '#687a3d']

export type Range = keyof typeof ranges
export type CalculationPeriod = keyof typeof calculationPeriods | '自訂範圍'