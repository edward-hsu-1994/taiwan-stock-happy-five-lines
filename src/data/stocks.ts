export type Stock = {
  id: string
  name: string
  market: string
  price: number
  change: number
  pe: number
  dividend: number
  fairValue: number
  zone: string
  dates: string[]
  prices: number[]
}

export const stocks: Stock[] = [
  {
    id: '2330', name: '台積電', market: 'TWSE', price: 1080, change: 1.89, pe: 21.4,
    dividend: 1.68, fairValue: 1240, zone: '合理價',
    dates: ['02/24', '03/03', '03/10', '03/17', '03/24', '03/31', '04/07', '04/14', '04/21', '04/28', '05/05', '05/12'],
    prices: [952, 978, 965, 1002, 1025, 1014, 1038, 1052, 1068, 1042, 1060, 1080],
  },
  {
    id: '2317', name: '鴻海', market: 'TWSE', price: 168.5, change: -0.88, pe: 14.8,
    dividend: 3.92, fairValue: 190, zone: '合理價',
    dates: ['02/24', '03/03', '03/10', '03/17', '03/24', '03/31', '04/07', '04/14', '04/21', '04/28', '05/05', '05/12'],
    prices: [151, 156, 154, 160, 164, 158, 162, 166, 171, 165, 170, 168.5],
  },
]
