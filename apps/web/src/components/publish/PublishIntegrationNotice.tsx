import { IntegrationNotice } from "@/components/common/IntegrationNotice";

export interface PublishIntegrationNoticeProps {
  message: string | null;
  className?: string;
}

/** Publish-page integration / workflow notices — reuses shared IntegrationNotice styling. */
export function PublishIntegrationNotice({
  message,
  className = "",
}: PublishIntegrationNoticeProps) {
  return <IntegrationNotice message={message} className={className} />;
}