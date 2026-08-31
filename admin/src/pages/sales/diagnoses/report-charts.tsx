import { Chart } from '@antv/g2';
import { Empty } from 'antd';
import { useEffect, useRef } from 'react';

export type DiagnosisChartDatum = {
  label: string;
  value: number;
};

type DiagnosisReportChartProps = {
  data: DiagnosisChartDatum[];
  kind: 'bar' | 'donut';
  height?: number;
};

export function DiagnosisReportChart({
  data,
  kind,
  height = 260,
}: DiagnosisReportChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return undefined;
    const chart = new Chart({
      container: containerRef.current,
      autoFit: true,
      height,
    });
    if (kind === 'donut') {
      chart.options({
        type: 'interval',
        data,
        coordinate: { type: 'theta', innerRadius: 0.58 },
        transform: [{ type: 'stackY' }],
        encode: { y: 'value', color: 'label' },
        tooltip: { items: [{ channel: 'y', valueFormatter: '.1%' }] },
        legend: {
          color: { position: 'bottom', layout: { justifyContent: 'center' } },
        },
      });
    } else {
      chart.options({
        type: 'interval',
        data,
        encode: { x: 'label', y: 'value', color: 'label' },
        axis: { x: { labelAutoRotate: false }, y: { labelFormatter: '.0%' } },
        tooltip: { items: [{ channel: 'y', valueFormatter: '.1%' }] },
        legend: false,
      });
    }
    void chart.render();
    return () => chart.destroy();
  }, [data, height, kind]);

  if (data.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="暂无可计算数据"
      />
    );
  }
  return (
    <div ref={containerRef} style={{ minHeight: height, width: '100%' }} />
  );
}
