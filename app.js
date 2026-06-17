
// 1. Custom Cursor Movement
const cursor = document.querySelector('.cursor');
document.addEventListener('mousemove', (e) => {
  cursor.style.left = e.clientX + 'px';
  cursor.style.top = e.clientY + 'px';
});

// 2. Reading Progress Bar
window.onscroll = () => {
  let winScroll = document.body.scrollTop || document.documentElement.scrollTop;
  let height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
  document.getElementById('progressBar').style.width = (winScroll / height) * 100 + "%";
};

// 3. Scroll Reveal Observer
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); });
}, { threshold: 0.1 });
document.querySelectorAll('.fade-up').forEach((el) => observer.observe(el));

// 4. SEO Injector Function
function updateSEO(title, summary) {
  document.title = `${title} | The Marginalia`;
  const meta = document.createElement('meta');
  meta.name = "description";
  meta.content = summary;
  document.head.appendChild(meta);
  
  // JSON-LD Injection
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.text = JSON.stringify({ "@context": "https://schema.org", "@type": "Article", "headline": title });
  document.head.appendChild(script);
}
