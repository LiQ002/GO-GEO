import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import { history, useParams } from '@umijs/max';
import { Button, Result, Space, Spin } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { salesDiagnosisServiceGetSalesDiagnosis } from '@/services/geo-admin/salesDiagnosisService';
import { DiagnosisReportView } from './report-view';

export default function SalesDiagnosisReportPage() {
  const { id } = useParams<{ id: string }>();
  const [diagnosis, setDiagnosis] = useState<API.SalesDiagnosis>();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    document.body.classList.add('sales-diagnosis-report-document');
    return () => {
      document.body.classList.remove('sales-diagnosis-report-document');
    };
  }, []);

  const load = useCallback(async () => {
    if (!id) {
      setFailed(true);
      return;
    }
    try {
      const reply = await salesDiagnosisServiceGetSalesDiagnosis({ id });
      setDiagnosis(reply);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [id]);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (!diagnosis) return undefined;
    const previousTitle = document.title;
    document.title = `${
      diagnosis.report?.title ?? diagnosis.name ?? '诊断报告'
    } - GEO`;
    return () => {
      document.title = previousTitle;
    };
  }, [diagnosis]);

  if (loading) {
    return (
      <main className="sales-diagnosis-report-page sales-diagnosis-report-state">
        <Spin size="large" tip="正在加载诊断报告" />
      </main>
    );
  }

  if (failed || !diagnosis) {
    return (
      <main className="sales-diagnosis-report-page sales-diagnosis-report-state">
        <Result
          status="error"
          title="诊断报告加载失败"
          subTitle="请确认诊断记录存在，并检查当前账号是否有查看权限。"
          extra={<Button onClick={() => void load()}>重新加载</Button>}
        />
      </main>
    );
  }

  if (!diagnosis.report) {
    return (
      <main className="sales-diagnosis-report-page sales-diagnosis-report-state">
        <Result
          status="info"
          title="诊断报告尚未生成"
          subTitle="请等待诊断执行完成后再打开报告。"
          extra={
            <Button onClick={() => history.push(`/sales/diagnoses/${id}`)}>
              返回诊断详情
            </Button>
          }
        />
      </main>
    );
  }

  return (
    <main className="sales-diagnosis-report-page">
      <DiagnosisReportView
        diagnosis={diagnosis}
        action={
          <Space wrap>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => history.push(`/sales/diagnoses/${id}`)}
            >
              返回详情
            </Button>
            <Button
              type="primary"
              icon={<PrinterOutlined />}
              onClick={() => window.print()}
            >
              打印 / 另存 PDF
            </Button>
          </Space>
        }
      />
    </main>
  );
}
