export interface PublishChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

export interface PublishMobilePreview {
  appName: string;
  chapterLabel: string;
  excerpt: string;
  readMoreLabel: string;
}

export interface PublishPackage {
  projectId: string;
  chapterNumber: number;
  chapterTitle: string;
  title: string;
  blurb: string;
  teaser: string;
  caption: string;
  commentBait: string;
  nextChapterTeaser: string;
  tags: string[];
  checklist: PublishChecklistItem[];
  mobilePreview: PublishMobilePreview;
  dashboardRoute: string;
  summaryRoute: string;
  outlineRoute: string;
  pageCopy: {
    badgeLabel: string;
    title: string;
    subtitle: string;
    blurbLabel: string;
    titleLabel: string;
    teaserLabel: string;
    captionLabel: string;
    commentBaitLabel: string;
    nextChapterLabel: string;
    tagsLabel: string;
    checklistTitle: string;
    mobilePreviewTitle: string;
    dashboardCta: string;
    summaryCta: string;
    nextChapterCta: string;
    nextChapterHint: string;
  };
}