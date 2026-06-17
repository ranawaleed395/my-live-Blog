const SUPABASE_URL = "https://zkpsgotkjlwroklhdmnc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprcHNnb3Rramx3cm9rbGhkbW5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MTk1NDAsImV4cCI6MjA5NzI5NTU0MH0.7dO2BJbqgRo7jPFq9bueO2ZDKogoMDYsABnTqjAuWbM";
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
