import EChartsReactCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { LineChart, type LineSeriesOption } from 'echarts/charts'
import {
  GridComponent,
  MarkLineComponent,
  TooltipComponent,
  type GridComponentOption,
  type MarkLineComponentOption,
  type TooltipComponentOption,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { CSSProperties } from 'react'

echarts.use([LineChart, GridComponent, MarkLineComponent, TooltipComponent, CanvasRenderer])
type EChartsOption = echarts.ComposeOption<LineSeriesOption | GridComponentOption | MarkLineComponentOption | TooltipComponentOption>

type StockChartProps = {
  option: EChartsOption
  notMerge?: boolean
  style?: CSSProperties
}

export default function StockChart({ option, notMerge, style }: StockChartProps) {
  return <EChartsReactCore echarts={echarts} option={option} notMerge={notMerge} style={style} />
}
