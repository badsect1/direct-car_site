import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. 경량 .env 파서
function loadEnv(filePath) {
  if (fs.existsSync(filePath)) {
    const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const eqIdx = trimmed.indexOf('=');
        const k = trimmed.slice(0, eqIdx).trim();
        const v = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[k]) {
          process.env[k] = v;
        }
      }
    }
  }
}

loadEnv(path.join(rootDir, '.env'));
loadEnv(path.join(rootDir, '..', 'car-direct.kr', '.env'));

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('❌ 오류: GEMINI_API_KEY 환경변수가 설정되지 않았습니다. .env 파일에 키를 입력해주세요.');
  process.exit(1);
}

// 2. 기존 포스트 목록 및 설정 로드
const postsFilePath = path.join(rootDir, 'data', 'posts.json');
let existingPosts = [];
try {
  if (fs.existsSync(postsFilePath)) {
    existingPosts = JSON.parse(fs.readFileSync(postsFilePath, 'utf-8'));
  }
} catch (e) {
  console.warn('⚠️ posts.json 읽기 실패, 신규 초기화:', e.message);
}

const topicsFilePath = path.join(rootDir, 'data', 'topics_insurance_seo_geo.json');
const topicsData = JSON.parse(fs.readFileSync(topicsFilePath, 'utf-8'));

const siteConfigFilePath = path.join(rootDir, 'data', 'site_config.json');
const siteConfig = JSON.parse(fs.readFileSync(siteConfigFilePath, 'utf-8'));

console.log(`📊 현재 등록된 칼럼 수: ${existingPosts.length}개`);

// 3. 중복되지 않는 새로운 토픽 조합 무작위 선정
const existingTitles = existingPosts.map(p => p.title).join(' | ');
const existingSlugs = new Set(existingPosts.map(p => p.id));

const randomCategory = topicsData.categories[Math.floor(Math.random() * topicsData.categories.length)];
const randomSubtopic = randomCategory.subtopics[Math.floor(Math.random() * randomCategory.subtopics.length)];
const randomVehicle = topicsData.vehicleTypes[Math.floor(Math.random() * topicsData.vehicleTypes.length)];
const randomAgeGroup = topicsData.ageGroups[Math.floor(Math.random() * topicsData.ageGroups.length)];
const randomInsurer = topicsData.insurers[Math.floor(Math.random() * topicsData.insurers.length)];
const randomTemplate = topicsData.curatedTopicTemplates[Math.floor(Math.random() * topicsData.curatedTopicTemplates.length)];

// 오늘 날짜 (KST 기준)
const now = new Date();
const kstOffset = 9 * 60; // UTC+9
const kstTime = new Date(now.getTime() + (now.getTimezoneOffset() + kstOffset) * 60000);
const yyyy = kstTime.getFullYear();
const mm = String(kstTime.getMonth() + 1).padStart(2, '0');
const dd = String(kstTime.getDate()).padStart(2, '0');
const todayIso = `${yyyy}-${mm}-${dd}`;
const todayFormatted = `${yyyy}년 ${Number(mm)}월 ${Number(dd)}일`;

// 4. Gemini 프롬프트 구성 (SEO & GEO & 보험 비교견적 전환 최적화)
const prompt = `
당신은 대한민국 대표 다이렉트 자동차보험 비교견적 전문 사이트 "${siteConfig.siteName}"의 15년 경력 공인 손해보험 수석 전문 애널리스트입니다.
Google 검색, 네이버 서치어드바이저, 그리고 Perplexity, ChatGPT Search, Google AI Overviews 등 최신 생성형 AI 검색(GEO)에 최적화된 심층 자동차보험 정보 칼럼 아티클을 1편 작성해주세요.

[추천 타겟 주제 및 컨텍스트]:
- 주요 카테고리: ${randomCategory.name} (${randomCategory.id})
- 세부 주제: ${randomSubtopic}
- 타겟 차종: ${randomVehicle}
- 타겟 운전자 연령층: ${randomAgeGroup}
- 주요 비교 손보사: ${randomInsurer} (현대해상, DB손보, KB손보, 한화손보, AXA손보, 흥국화재, 하나손보 등 7개 손해보험사)
- 참고 템플릿: ${randomTemplate.titleTemplate} (포커스: ${randomTemplate.focus})
- 비교견적 랜딩 URL: ${siteConfig.ctaUrl}

[기존 발행된 글 목록 (동일하거나 유사한 제목 절대 중복 금지)]:
${existingTitles || '없음 (첫 번째 칼럼)'}

[핵심 작성 가이드라인 (SEO & GEO & 신뢰도 극대화)]:
1. **타이틀(title)**: 검색엔진 클릭률(CTR)과 생성형 AI의 사용자 질문에 가장 잘 부합하는 명확하고 권위 있는 제목 (30~55자). 숫자를 활용하세요(예: 3가지 절약법, 10억 추천 이유, 최대 45% 환급 등).
2. **요약문(summary)**: 2~3문장(100~140자)으로 작성. AI 검색 엔진(Perplexity, ChatGPT 등)이 즉각 인용할 수 있는 명쾌한 결론(Direct Answer) 형태로 서술.
3. **slug(id)**: 영문 소문자, 숫자, 하이픈(-)만 사용하여 3~5단어로 구성 (예: direct-car-insurance-10billion-coverage-2026).
4. **본문 HTML(contentHtml)**:
   - 본문 시작 부분에 반드시 <div class="geo-summary-box"><div class="geo-summary-title">💡 3줄 핵심 요약 (AI Direct Answer)</div><p class="geo-summary-desc">...</p></div> 포함
   - 각 소주제는 <h2>, 세부 항목은 <h3> 사용
   - <div class="geo-table-wrapper"><table>...</table></div> 형태로 옵션별 또는 보험사별 비교표(예: 대물 2억 vs 5억 vs 10억 보험료 차이, 마일리지 구간별 환급률, 주행거리별 절약액 등) 필수 1개 이상 포함
   - <div class="notice-box tip"><div class="notice-title">💡 전문가 실전 절약 팁</div><p>...</p></div> 또는 <div class="notice-box warning"><div class="notice-title">⚠️ 가입 전 주의사항</div><p>...</p></div> 강조 블록 1개 이상 포함
   - 본문 중간에 자연스럽게 1분 최저가 비교견적 CTA 배너 배치:
     <div class="intext-cta-banner"><h4>내 차 다이렉트 자동차보험료, 1분 만에 최저가 비교해보세요</h4><p>국내 주요 7대 손해보험사(한화, 현대해상, DB, KB, AXA, 흥국, 하나 등)의 특약 할인율을 한 번에 계산해 드립니다.</p><a href="${siteConfig.ctaUrl}" target="_blank" rel="noopener noreferrer" class="btn-cta-large">⚡ 1분 최저가 비교견적 조회하기</a></div>
   - 정확한 보험 법률/규정(자동차손해배상보장법, 도로교통법, 손해보험협회 표준약관 등) 인용
5. **자주 묻는 질문(faqs)**:
   - 실제 운전자가 네이버나 구글, 챗GPT에 검색하는 구어체 질문 3~4개와 각 2~3문장의 명쾌한 팩트 답변
`;

// 5. 지원 모델 검색 함수
async function getAvailableModel() {
  try {
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const listRes = await fetch(listUrl);
    if (listRes.ok) {
      const data = await listRes.json();
      const models = (data.models || [])
        .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
        .map(m => m.name.replace('models/', ''));
      
      console.log('🤖 지원 모델 목록 확인:', models.slice(0, 5).join(', '));
      const priorityOrder = ['gemini-3.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro'];
      for (const p of priorityOrder) {
        if (models.includes(p)) return p;
      }
      if (models.length > 0) return models[0];
    }
  } catch (e) {
    console.warn('⚠️ 모델 목록 조회 예외, 기본 모델군 시도:', e.message);
  }
  return 'gemini-3.5-flash-lite';
}

function safeJsonParse(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    cleaned = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, match => {
      if (match === '\n') return '\\n';
      if (match === '\r') return '\\r';
      if (match === '\t') return '\\t';
      return '';
    });
    return JSON.parse(cleaned);
  }
}

// 6. Gemini 호출 및 포스트 생성
async function generateArticle() {
  console.log('🔍 Gemini 최적 모델 탐색 중...');
  const bestModel = await getAvailableModel();
  console.log(`✨ 선택된 AI 모델: ${bestModel}`);

  const candidateModels = [bestModel, 'gemini-2.5-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-pro'];
  const uniqueModels = [...new Set(candidateModels)];

  let rawText = null;
  let lastError = null;

  for (const model of uniqueModels) {
    try {
      console.log(`📡 [${model}] 자동차보험 전문 칼럼 생성 요청 전송...`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                id: { type: "STRING", description: "영문 소문자와 하이픈으로 구성된 고유 slug" },
                title: { type: "STRING", description: "SEO 및 클릭률에 최적화된 기사 제목" },
                summary: { type: "STRING", description: "2~3문장의 핵심 요약 (AI Direct Answer용)" },
                keywords: { type: "STRING", description: "콤마로 구분된 핵심 키워드 5~7개" },
                category: { type: "STRING", description: "discount, coverage, age-vehicle, renewal, compare 중 하나" },
                categoryName: { type: "STRING", description: "카테고리 한글명" },
                vehicle: { type: "STRING", description: "관련 차종 또는 '전차종'" },
                ageGroup: { type: "STRING", description: "관련 연령대 또는 '전연령'" },
                contentHtml: { type: "STRING", description: "h2, h3, 표, 요약박스, 팁/주의박스, 배너가 포함된 본문 HTML" },
                faqs: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      question: { type: "STRING", description: "자주 묻는 질문" },
                      answer: { type: "STRING", description: "명확한 팩트 답변" }
                    },
                    required: ["question", "answer"]
                  }
                }
              },
              required: ["id", "title", "summary", "keywords", "category", "categoryName", "vehicle", "ageGroup", "contentHtml", "faqs"]
            }
          }
        })
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.warn(`⚠️ [${model}] 응답 에러 (${response.status}): ${errBody.slice(0, 150)}...`);
        lastError = new Error(`Status ${response.status}: ${errBody}`);
        continue;
      }

      const data = await response.json();
      rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        console.log(`✅ [${model}] 칼럼 콘텐츠 생성 성공!`);
        break;
      }
    } catch (err) {
      console.warn(`⚠️ [${model}] 호출 실패:`, err.message);
      lastError = err;
    }
  }

  if (!rawText) {
    throw lastError || new Error('모든 Gemini 모델 호출에 실패했습니다.');
  }

  const postData = safeJsonParse(rawText);

  // slug 정제 및 중복 방지
  let slug = (postData.id || `direct-car-guide-${Date.now()}`).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (existingSlugs.has(slug)) {
    slug = `${slug}-${Date.now().toString().slice(-4)}`;
  }
  postData.id = slug;
  postData.date = todayIso;
  postData.formattedDate = todayFormatted;

  console.log(`🎉 생성 완료: [${postData.categoryName} | ${postData.vehicle}] ${postData.title}`);

  // 7. Schema.org FAQ 및 Article JSON-LD 생성
  const faqSchemaItems = (postData.faqs || []).map(item => ({
    "@type": "Question",
    "name": item.question,
    "acceptedAnswer": {
      "@type": "Answer",
      "text": item.answer
    }
  }));

  const jsonLdData = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": postData.title,
      "description": postData.summary,
      "keywords": postData.keywords,
      "datePublished": `${todayIso}T08:30:00+09:00`,
      "dateModified": `${todayIso}T08:30:00+09:00`,
      "author": {
        "@type": "Organization",
        "name": siteConfig.siteName,
        "url": siteConfig.siteUrl
      },
      "publisher": {
        "@type": "Organization",
        "name": siteConfig.siteName,
        "url": siteConfig.siteUrl
      },
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": `${siteConfig.siteUrl}/posts/${slug}/`
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqSchemaItems
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "다이렉트자동차보험파트너",
          "item": `${siteConfig.siteUrl}/`
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "보험정보 칼럼",
          "item": `${siteConfig.siteUrl}/posts/`
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": postData.categoryName,
          "item": `${siteConfig.siteUrl}/posts/?category=${postData.category}`
        },
        {
          "@type": "ListItem",
          "position": 4,
          "name": postData.title,
          "item": `${siteConfig.siteUrl}/posts/${slug}/`
        }
      ]
    }
  ];

  // FAQ HTML 생성
  const faqHtml = (postData.faqs || []).map(item => `
    <div class="faq-item">
      <div class="faq-question">${item.question}</div>
      <div class="faq-answer">${item.answer}</div>
    </div>
  `).join('');

  // 8. 개별 아티클 정적 HTML 템플릿 생성
  const postDir = path.join(rootDir, 'posts', slug);
  if (!fs.existsSync(postDir)) {
    fs.mkdirSync(postDir, { recursive: true });
  }

  const htmlContent = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <title>${postData.title} | ${siteConfig.brandShort}</title>
  <meta name="description" content="${postData.summary}" />
  <meta name="keywords" content="${postData.keywords}" />
  <link rel="canonical" href="${siteConfig.siteUrl}/posts/${slug}/" />

  <!-- 오픈그래프 (SNS / 카카오톡 공유) -->
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${siteConfig.siteUrl}/posts/${slug}/" />
  <meta property="og:title" content="${postData.title}" />
  <meta property="og:description" content="${postData.summary}" />

  <!-- Pretendard 웹폰트 및 스타일시트 -->
  <link rel="stylesheet" as="style" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css" />
  <link rel="stylesheet" href="/posts/assets/style.css" />

  <!-- Schema.org 구조화 데이터 (Article, FAQPage, BreadcrumbList) -->
  <script type="application/ld+json">
  ${JSON.stringify(jsonLdData, null, 2)}
  </script>
</head>

<body>
  <!-- 상단 헤더 -->
  <header class="site-nav">
    <div class="nav-container">
      <div class="nav-row">
        <a href="/" class="nav-brand" title="다이렉트자동차보험파트너 홈으로 이동">
          <div class="nav-logo-box">D</div>
          <span class="nav-brand-title">다이렉트자동차보험파트너</span>
        </a>
        <nav class="nav-links">
          <a href="/guide.html" class="nav-link">가입안내</a>
          <a href="/accident.html" class="nav-link">사고대처안내</a>
          <a href="/faq.html" class="nav-link">FAQ</a>
          <a href="/posts/" class="nav-link active">보험정보</a>
          <a href="${siteConfig.ctaUrl}" target="_blank" rel="noopener noreferrer" class="btn-header-cta">
            <span>⚡ 1분 최저가 비교견적</span>
          </a>
        </nav>
        <button id="mobileMenuToggle" class="mobile-menu-toggle" aria-label="메뉴 열기">
          <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>
      </div>
    </div>
    <div id="mobileMenu" class="mobile-menu">
      <a href="/guide.html" class="mobile-nav-link">가입안내</a>
      <a href="/accident.html" class="mobile-nav-link">사고대처안내</a>
      <a href="/faq.html" class="mobile-nav-link">FAQ</a>
      <a href="/posts/" class="mobile-nav-link active">보험정보</a>
      <a href="${siteConfig.ctaUrl}" target="_blank" rel="noopener noreferrer" class="btn-header-cta" style="margin-top: 8px; justify-content: center;">
        <span>⚡ 1분 최저가 비교견적</span>
      </a>
    </div>
  </header>

  <!-- 아티클 본문 영역 -->
  <article class="article-container">
    <!-- 빵부스러기 (Breadcrumb) -->
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href="/">홈</a> &gt;
      <a href="/posts/">보험정보 칼럼</a> &gt;
      <a href="/posts/">${postData.categoryName}</a> &gt;
      <span>${postData.vehicle}</span>
    </nav>

    <!-- 글 헤더 -->
    <header class="article-header">
      <div class="article-meta-tags">
        <span class="badge-cat">${postData.categoryName}</span>
        <span class="badge-tag">🚗 ${postData.vehicle}</span>
        <span class="badge-tag">👤 ${postData.ageGroup}</span>
      </div>
      <h1 class="article-title">${postData.title}</h1>
      <div class="article-meta-info">
        <span>✍️ 다이렉트자동차보험파트너 수석 애널리스트</span>
        <span>📅 ${postData.formattedDate}</span>
        <span>⏱️ 소요시간 약 4분</span>
      </div>
    </header>

    <!-- 아티클 본문 -->
    <section class="article-body">
      ${postData.contentHtml}

      <!-- GEO FAQ 섹션 -->
      <div class="geo-faq-section">
        <h3 class="geo-faq-title">❓ 자주 묻는 질문 (FAQ)</h3>
        <div class="faq-list">
          ${faqHtml}
        </div>
      </div>

      <!-- 본문 하단 전환 CTA 배너 -->
      <div class="cta-banner-box">
        <h3>내 차 다이렉트 보험료, 1분 만에 최저가를 찾아보세요</h3>
        <p>현대해상, DB손해보험, KB손해보험, 한화손해보험, AXA 등 주요 7대 손해보험사 특약 할인을 실시간 비교해 드립니다.</p>
        <div class="cta-buttons">
          <a href="${siteConfig.ctaUrl}" target="_blank" rel="noopener noreferrer" class="btn-cta-quote">
            <span>⚡ 내 차 다이렉트 최저가 비교견적 확인</span>
          </a>
          <a href="/posts/" class="btn-cta-sub">
            <span>다른 보험 꿀팁 보기</span>
          </a>
        </div>
      </div>

      <!-- 손해보험 광고 가이드라인 준수 고지 -->
      <div class="compliance-box">
        <p>※ 해당 광고물은 한화손보, 흥국화재, 현대해상, KB손보, DB손보, AXA손보, 하나손보의 공동 광고물입니다.</p>
        <p>※ 해당 보험사는 관련 상품에 대해 충분히 설명할 의무가 있으며, 가입자는 가입에 앞서 이에 대한 충분한 설명을 받으시기 바랍니다.</p>
        <p>※ 보험계약 체결 전 반드시 상품설명서 및 약관을 확인하시기 바랍니다.</p>
        <p>※ 금융소비자는 해당 상품 또는 서비스에 대하여 설명을 받을 권리가 있습니다.</p>
        <p>※ 이 보험계약은 예금자보호법에 따라 해약환급금(또는 만기 시 보험금)에 기타지급금을 합한 금액이 1인당 “1억원까지”(본 보험회사의 여타 보호 상품과 합산) 보호됩니다.</p>
        <p>하나손해보험 준법감시인 확인필 202604-071 / 한화손해보험 확인필-제2026-자동차TM지원-기타(광고)02030C-전사 / 현대해상 준법감시인 심의필 제20261241호 / AXA손해보험 검-260414-마케팅팀-166 / DB손해보험 준법감시인 확인필_제2026-12467호 / KB손해보험 준법감시인 심의필 제2026-1021호 / 흥국화재보험 준법감시인 확인필T-260420-04-002</p>
      </div>
    </section>
  </article>

  <!-- 푸터 -->
  <footer class="site-footer">
    <div class="footer-container">
      <div class="footer-top">
        <div class="footer-brand">다이렉트자동차보험파트너</div>
        <div class="footer-insurers">제휴사: 한화손보 · 흥국화재 · 현대해상 · KB손보 · DB손보 · AXA손보 · 하나손보</div>
      </div>
      <div class="footer-legal-notices">
        <p>본 칼럼은 금융소비자의 합리적인 자동차보험 선택과 권익 보호를 위해 객관적인 공시자료 및 약관을 바탕으로 작성되었습니다.</p>
      </div>
      <div class="footer-bottom">
        <div>
          <p><strong>다이렉트자동차보험파트너</strong> | 대표자 : 김승규 | 사업자등록번호 : 265-19-00725</p>
          <p>서울특별시 중구 퇴계로34길 16, 5층 2호(필동1가)</p>
        </div>
        <div>
          <p>Copyright ⓒ DirectCarPlus. All rights Reserved.</p>
        </div>
      </div>
    </div>
  </footer>

  <!-- 모바일 하단 고정 비교견적 바 -->
  <aside class="mobile-sticky-bar">
    <a href="${siteConfig.ctaUrl}" target="_blank" rel="noopener noreferrer" class="mobile-quote-btn">
      <span>⚡ 내 차 다이렉트 보험료 1분 최저가 확인</span>
    </a>
  </aside>

  <script src="/posts/assets/script.js"></script>
</body>
</html>`;

  fs.writeFileSync(path.join(postDir, 'index.html'), htmlContent, 'utf-8');
  console.log(`💾 HTML 파일 저장 완료: posts/${slug}/index.html`);

  // 9. data/posts.json 업데이트
  const updatedPosts = [
    {
      id: postData.id,
      title: postData.title,
      summary: postData.summary,
      category: postData.category,
      categoryName: postData.categoryName,
      vehicle: postData.vehicle,
      ageGroup: postData.ageGroup,
      keywords: postData.keywords,
      date: postData.date,
      formattedDate: postData.formattedDate,
      url: `/posts/${slug}/`
    },
    ...existingPosts.filter(p => p.id !== postData.id)
  ];
  fs.writeFileSync(postsFilePath, JSON.stringify(updatedPosts, null, 2), 'utf-8');
  console.log(`💾 data/posts.json 갱신 완료 (총 ${updatedPosts.length}개)`);

  // 10. posts/index.html 카드 그리드 정적 재렌더링
  updateHubPage(updatedPosts);

  // 11. sitemap.xml 자동 업데이트
  updateSitemap(updatedPosts);

  console.log('🏁 모든 포스팅 파이프라인 작업이 완료되었습니다.');
}

// 허브 페이지(posts/index.html)에 최신 카드 리스트 반영
function updateHubPage(posts) {
  const hubPath = path.join(rootDir, 'posts', 'index.html');
  if (!fs.existsSync(hubPath)) return;

  let hubHtml = fs.readFileSync(hubPath, 'utf-8');

  const cardsHtml = posts.map(p => `
      <article class="post-card" data-category="${p.category}">
        <div class="card-top">
          <span class="badge-cat">${p.categoryName}</span>
          <span class="badge-tag">🚗 ${p.vehicle || '전차종'}</span>
          <span class="card-date">${p.date}</span>
        </div>
        <h3 class="card-title">
          <a href="/posts/${p.id}/">${p.title}</a>
        </h3>
        <p class="card-summary">${p.summary}</p>
        <div class="card-footer">
          <a href="/posts/${p.id}/">자세히 읽기 <span class="arrow">→</span></a>
        </div>
      </article>
  `).join('\n');

  const startMarker = '<!-- POSTS_CONTAINER_START -->';
  const endMarker = '<!-- POSTS_CONTAINER_END -->';

  const startIndex = hubHtml.indexOf(startMarker);
  const endIndex = hubHtml.indexOf(endMarker);

  if (startIndex !== -1 && endIndex !== -1) {
    const newHubHtml = hubHtml.slice(0, startIndex + startMarker.length) +
      '\n' + cardsHtml + '\n      ' +
      hubHtml.slice(endIndex);
    fs.writeFileSync(hubPath, newHubHtml, 'utf-8');
    console.log(`💾 posts/index.html 허브 카드 리스트 갱신 완료 (${posts.length}개 카드)`);
  }
}

// sitemap.xml 자동 갱신
function updateSitemap(posts) {
  const sitemapPath = path.join(rootDir, 'sitemap.xml');
  const baseUrl = siteConfig.siteUrl || 'https://direct-car.co.kr';

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- 메인 홈페이지 -->
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${todayIso}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <!-- 자동차보험 정보마당 허브 -->
  <url>
    <loc>${baseUrl}/posts/</loc>
    <lastmod>${todayIso}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <!-- 안내 페이지 -->
  <url>
    <loc>${baseUrl}/guide.html</loc>
    <lastmod>${todayIso}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.85</priority>
  </url>
  <url>
    <loc>${baseUrl}/accident.html</loc>
    <lastmod>${todayIso}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.85</priority>
  </url>
  <url>
    <loc>${baseUrl}/faq.html</loc>
    <lastmod>${todayIso}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.85</priority>
  </url>
`;

  posts.forEach(p => {
    xml += `  <url>
    <loc>${baseUrl}/posts/${p.id}/</loc>
    <lastmod>${p.date || todayIso}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>\n`;
  });

  xml += `</urlset>\n`;
  fs.writeFileSync(sitemapPath, xml, 'utf-8');
  console.log(`💾 sitemap.xml 갱신 완료 (총 ${posts.length + 5}개 URL 등록)`);
}

generateArticle().catch(err => {
  console.error('❌ 포스트 생성 중 오류 발생:', err);
  process.exit(1);
});
