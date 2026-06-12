export function extractJobCards() {
  const cards = document.querySelectorAll('.job-card-wrapper');
  return Array.from(cards).map((card, index) => ({
    index,
    element: card,
    title: card.querySelector('.job-name')?.textContent?.trim() || '',
    company: card.querySelector('.company-name')?.textContent?.trim() || '',
    salary: card.querySelector('.salary')?.textContent?.trim() || '',
    location: card.querySelector('.job-area')?.textContent?.trim() || '',
  }));
}

export function extractJobDetail() {
  return {};
}
