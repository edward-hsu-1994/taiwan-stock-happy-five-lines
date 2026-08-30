import EChartsReactCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { LineChart, type LineSeriesOption } from 'echarts/charts'
import { GridComponent, TooltipComponent, type GridComponentOption, type TooltipComponentOption } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { CSSProperties } from 'react'

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer])
type EChartsOption = echarts.ComposeOption<LineSeriesOption | GridComponentOption | TooltipComponentOption>

type StockChartProps = {
  option: EChartsOption
  notMerge?: boolean
  style?: CSSProperties
}

export default function StockChart({ option, notMerge, style }: StockChartProps) {
  return <EChartsReactCore echarts={echarts} option={option} notMerge={notMerge} style={style} />
}
