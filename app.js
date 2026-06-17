
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
// Example of how you use it after pulling from Supabase
const myEssay = data[0]; // The data returned from your database

// Update the visual page
document.getElementById('essay-title').innerText = myEssay.title;
document.getElementById('essay-content').innerHTML = myEssay.body;

// FIRE THE SEO INJECTOR
updateSEO(myEssay.title, myEssay.summary, myEssay.cover_image);
/**
 * SEO Meta Injector
 * Call this function immediately after fetching your essay from Supabase.
 */
function updateSEO(essayTitle, essaySummary, essayImage) {
  // 1. Update the Browser Tab & Search Engine Title
  document.getElementById('seo-title').innerText = `${essayTitle} | the marginalia.`;
  document.getElementById('og-title').setAttribute('content', essayTitle);

  // 2. Update the Search Engine Description (Keep under 160 characters)
  document.getElementById('seo-desc').setAttribute('content', essaySummary);
  document.getElementById('og-desc').setAttribute('content', essaySummary);

  // 3. Update the Social Media Preview Image
  if (essayImage) {
    document.getElementById('og-image').setAttribute('content', essayImage);
  }

  // 4. The VIP Pass: JSON-LD Structured Data
  // This tells Google exactly what this content is so it can feature it in Rich Snippets
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": essayTitle,
    "description": essaySummary,
    "author": {
      "@type": "Person",
      "name": "Editor"
    }
  };

  // Inject the schema into the page invisibly
  const scriptTag = document.createElement('script');
  scriptTag.type = "application/ld+json";
  scriptTag.text = JSON.stringify(schema);
  document.head.appendChild(scriptTag);
}
