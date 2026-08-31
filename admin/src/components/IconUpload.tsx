import { PlusOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd';
import { App, Form, Upload } from 'antd';
import { useEffect, useState } from 'react';

type IconUploadRequest = {
  filename?: string;
  contentType?: string;
  content?: string;
};

type IconUploadReply = {
  url?: string;
};

export type IconUploadProps = {
  label: string;
  upload: (request: IconUploadRequest) => Promise<IconUploadReply>;
};

const maxIconBytes = 2 * 1024 * 1024;
const allowedIconTypes = new Set(['image/jpeg', 'image/png']);

const fileToBase64 = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const result = String(reader.result ?? '');
      const separator = result.indexOf(',');
      resolve(separator >= 0 ? result.slice(separator + 1) : result);
    });
    reader.addEventListener('error', () =>
      reject(reader.error ?? new Error('读取图片失败')),
    );
    reader.readAsDataURL(file);
  });

const uploadedFile = (url: string, label: string): UploadFile => ({
  uid: url,
  name: label,
  status: 'done',
  url,
});

const IconUpload = ({ label, upload }: IconUploadProps) => {
  const form = Form.useFormInstance();
  const icon = Form.useWatch<string>('icon', form);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const { message } = App.useApp();

  useEffect(() => {
    setFileList(icon ? [uploadedFile(icon, label)] : []);
  }, [icon, label]);

  const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    if (!allowedIconTypes.has(file.type)) {
      message.error('仅支持 PNG、JPG 或 JPEG 图片');
      return Upload.LIST_IGNORE;
    }
    if (file.size > maxIconBytes) {
      message.error(`${label}不能超过 2 MB`);
      return Upload.LIST_IGNORE;
    }
    return true;
  };

  const customRequest: UploadProps['customRequest'] = async (options) => {
    const file = options.file as File & { uid?: string };
    const uid = file.uid ?? `${file.name}-${file.lastModified}`;
    setFileList([
      {
        uid,
        name: file.name,
        status: 'uploading',
        percent: 0,
      },
    ]);

    try {
      const content = await fileToBase64(file);
      const reply = await upload({
        filename: file.name,
        contentType: file.type,
        content,
      });
      if (!reply.url) throw new Error('上传接口未返回图标地址');
      form.setFieldValue('icon', reply.url);
      setFileList([
        {
          uid,
          name: file.name,
          status: 'done',
          percent: 100,
          url: reply.url,
        },
      ]);
      options.onSuccess?.(reply);
      message.success(`${label}上传成功`);
    } catch (error) {
      const uploadError =
        error instanceof Error ? error : new Error(`${label}上传失败`);
      setFileList([{ uid, name: file.name, status: 'error' }]);
      options.onError?.(uploadError);
    }
  };

  return (
    <Form.Item label={label} extra="支持 PNG、JPG、JPEG，文件不超过 2 MB">
      <Upload
        accept="image/png,image/jpeg"
        beforeUpload={beforeUpload}
        customRequest={customRequest}
        fileList={fileList}
        listType="picture-card"
        maxCount={1}
        onPreview={(file) => {
          if (file.url) window.open(file.url, '_blank', 'noopener,noreferrer');
        }}
        onRemove={() => {
          form.setFieldValue('icon', undefined);
          setFileList([]);
          return true;
        }}
      >
        {fileList.length === 0 ? (
          <div>
            <PlusOutlined />
            <div style={{ marginTop: 8 }}>上传图标</div>
          </div>
        ) : null}
      </Upload>
    </Form.Item>
  );
};

export default IconUpload;
