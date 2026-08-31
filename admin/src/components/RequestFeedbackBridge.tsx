import { App } from 'antd';
import { useEffect } from 'react';

type FeedbackApi = ReturnType<typeof App.useApp>;

let feedbackApi: FeedbackApi | undefined;

export const showRequestError = (title: string, description: string) => {
  if (feedbackApi) {
    feedbackApi.notification.error({ title, description });
    return;
  }
  console.error(`${title}: ${description}`);
};

export const showRequestMessage = (content: string) => {
  if (feedbackApi) {
    feedbackApi.message.error(content);
    return;
  }
  console.error(content);
};

export const RequestFeedbackBridge = () => {
  const api = App.useApp();

  useEffect(() => {
    feedbackApi = api;
    return () => {
      if (feedbackApi === api) feedbackApi = undefined;
    };
  }, [api]);

  return null;
};
