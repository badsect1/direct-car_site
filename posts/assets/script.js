// direct-car.co.kr 칼럼 허브 및 개별 페이지 인터랙션 스크립트
document.addEventListener('DOMContentLoaded', () => {
  // 1. 모바일 햄버거 메뉴 토글
  const mobileToggle = document.getElementById('mobileMenuToggle');
  const mobileMenu = document.getElementById('mobileMenu');
  if (mobileToggle && mobileMenu) {
    mobileToggle.addEventListener('click', () => {
      mobileMenu.classList.toggle('open');
    });
  }

  // 2. FAQ 아코디언 토글 (개별 글 상세 페이지)
  const faqQuestions = document.querySelectorAll('.faq-question');
  faqQuestions.forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      if (item) {
        item.classList.toggle('active');
      }
    });
  });

  // 3. 허브 검색 및 카테고리 필터링 (posts/index.html)
  const searchInput = document.getElementById('hubSearchInput');
  const catButtons = document.querySelectorAll('.cat-btn');
  const postCards = document.querySelectorAll('.post-card');
  const visibleCountEl = document.getElementById('visiblePostCount');

  let currentCategory = 'all';
  let currentSearchQuery = '';

  function updateCards() {
    let count = 0;
    postCards.forEach(card => {
      const cardCat = card.getAttribute('data-category') || '';
      const text = card.textContent.toLowerCase();

      const matchCategory = (currentCategory === 'all' || cardCat === currentCategory);
      const matchSearch = (!currentSearchQuery || text.includes(currentSearchQuery));

      if (matchCategory && matchSearch) {
        card.style.display = 'flex';
        count++;
      } else {
        card.style.display = 'none';
      }
    });

    if (visibleCountEl) {
      visibleCountEl.textContent = `총 ${count}개의 칼럼`;
    }
  }

  if (catButtons.length > 0) {
    catButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        catButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentCategory = btn.getAttribute('data-category') || 'all';
        updateCards();
      });
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearchQuery = e.target.value.trim().toLowerCase();
      updateCards();
    });
  }

  // 초기 카운트 업데이트
  if (visibleCountEl && postCards.length > 0) {
    visibleCountEl.textContent = `총 ${postCards.length}개의 칼럼`;
  }
});
