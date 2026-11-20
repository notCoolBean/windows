window.WEB_EXTRACT_RULES = [
  {
    code: 'ccdi',
    name: '中纪委网站',
    match: { selectors: ['.Article_61', '.news-center', 'meta[content*="中央纪委国家监委网站"]'] },
    title: ['.Article_61 .tit', '.news-center h1', '.news-center h2', 'h1.tit'],
    article: ['.Article_61', '.news-center'],
    content: ['.Article_61 .content', '.news-center .artContent', '.news-center .content'],
    meta: ['.Article_61 .daty', '.news-center .news-info', '.news-center .daty']
  },
  {
    code: 'jwjw',
    name: '建言献策论坛',
    match: { selectors: ['.news-center .artContent', '.news-center', 'meta[content*="军委机关网"]'] },
    title: ['.news-center .news-title', '.news-center h1', '.news-center h2', '.news-center .title', 'title'],
    article: ['.news-center', '.w1040', '#app'],
    content: ['.news-center .artContent', '.news-center .content'],
    meta: ['.news-center .news-info', '.news-center .info', '.news-center']
  },
  {
    code: 'jwjw-inspect',
    name: '纪委专网',
    match: { selectors: ['h1.text-primary', '.column.col-9', '.show-content', '.body-container', 'meta[content*="军委纪委监委"]'] },
    title: ['h1.text-primary', 'h3.text-primary', 'h1', 'h3', 'title'],
    article: ['.column.col-9', '.body-container'],
    content: ['.show-content'],
    meta: ['.text-tip.text-small'],
    source: ['.text-tip.mt-6 .mb-2', '.text-tip.mt-6']
  }
];
