import { Context, Session } from 'koishi'
import { Api } from '../network/api'

export const PIE_CHART_KEYS = [ 'languages', 'editors', 'machines', 'operating_systems' ] as const
type PieChartKey = typeof PIE_CHART_KEYS[number]

const PIE_CHART_WIDTH = 400
const PIE_CHART_HEIGHT = 200

export const useRenderPieChart = (ctx: Context) => (session: Session, statsData: Api.StatsData['data'], key: PieChartKey) => {
    const list = statsData[key]

    const eh = ctx.echarts.createChart(PIE_CHART_WIDTH, PIE_CHART_HEIGHT, {
        backgroundColor: '#fff',
        title: {
            text: session.text(`wakatime.chart.${key}`),
            left: 'center',
            top: 'center',
            textStyle: {
                fontSize: 14,
            },
        },
        series: {
            type: 'pie',
            radius: '50%',
            center: [ '50%', '50%' ],
            data: list.map(({ name, percent }) => ({ name, value: percent })),
            label: {
                formatter: '{b}: {d}%',
            },
        },
    })

    return eh.export()
}