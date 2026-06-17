// Initialize configuration variables
const SUPABASE_URL = "https://zkpsgotkjlwroklhdmnc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprcHNnb3Rramx3cm9rbGhkbW5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MTk1NDAsImV4cCI6MjA5NzI5NTU0MH0.7dO2BJbqgRo7jPFq9bueO2ZDKogoMDYsABnTqjAuWbM";

// CRITICAL FIX: Explicitly use the global library instantiation safely
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const md = window.markdownit({ html: false, linkify: true, breaks: true });

let GlobalState = {
    posts: [],
    searchQuery: "",
    currentPage: 0,
    pageSize: 6,
    hasMorePosts: true,
    userSession: null,
    userRole: 'reader',
    displayName: ''
};

// Search debounce timer variable
let searchDebounceTimeout = null;

// Safe UI Object Actions
const UI = {
    openAuth: () => {
        const workspace = document.getElementById('appWorkspace');
        if (workspace) UI.renderAuthView(workspace);
    },
    renderAuthView: (target) => {
        target.innerHTML = `
            <div class="max-w-sm mx-auto bg-white p-8 border border-stone-200 rounded-2xl shadow-sm space-y-4">
                <h3 class="serif-title text-xl font-bold text-center">Secure Cloud Access</h3>
                <input type="text" id="authName" placeholder="Display Name (For Sign Up)" class="w-full border border-stone-200 rounded-xl px-4 py-2 text-sm bg-stone-50">
                <input type="email" id="authEmail" placeholder="Email Address" class="w-full border border-stone-200 rounded-xl px-4 py-2 text-sm bg-stone-50">
                <input type="password" id="authPassword" placeholder="Password" class="w-full border border-stone-200 rounded-xl px-4 py-2 text-sm bg-stone-50">
                <div class="flex gap-2 pt-2">
                    <button id="loginSubmitBtn" class="w-1/2 py-2 bg-teal-700 text-white font-bold text-xs uppercase rounded-xl">Log In</button>
                    <button id="registerSubmitBtn" class="w-1/2 border border-stone-300 text-stone-700 font-bold text-xs uppercase rounded-xl">Register</button>
                </div>
            </div>
        `;
        document.getElementById('loginSubmitBtn')?.addEventListener('click', handleLogin);
        document.getElementById('registerSubmitBtn')?.addEventListener('click', handleRegister);
    }
};

// Global Initialization
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (error) throw error;
        
        GlobalState.userSession = session;
        if (session) {
            GlobalState.displayName = session.user.user_metadata?.display_name || 'Admin';
            const { data, error: roleError } = await supabaseClient.from('user_profiles').select('role').eq('id', session.user.id).maybeSingle();
            if (!roleError && data) GlobalState.userRole = data.role;
        }
    } catch (err) {
        console.error("Auth initialization failed:", err.message);
    }
    
    window.addEventListener('hashchange', router);
    router();
});

// App Router Engine with Missing Element Boundaries
async function router() {
    const hash = window.location.hash || '#home';
    const workspace = document.getElementById('appWorkspace');
    if (!workspace) return;
    
    workspace.innerHTML = '';
    renderHeader();
    
    try {
        if (hash === '#home') {
            const { data, error } = await supabaseClient.from('posts').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            GlobalState.posts = data || [];
            renderHome(workspace);
        } else if (hash.startsWith('#post/')) {
            const id = hash.split('/')[1];
            const { data, error } = await supabaseClient.from('posts').select('*').eq('id', id).maybeSingle();
            if (error) throw error;
            if (data) {
                renderPostView(workspace, data);
            } else {
                workspace.innerHTML = `<p class="text-stone-500 text-sm italic py-12 text-center">The requested essay could not be found.</p>`;
            }
        } else if (hash === '#admin' && (GlobalState.userRole === 'admin' || GlobalState.userRole === 'owner')) {
            renderAdminRoom(workspace);
        } else {
            window.location.hash = '#home';
        }
    } catch (err) {
        workspace.innerHTML = `
            <div class="text-center py-12 max-w-md mx-auto space-y-3">
                <p class="text-red-700 font-medium">Database Core Connection Failure</p>
                <p class="text-xs text-stone-500 leading-relaxed">The application framework is unable to safely resolve cloud dependencies. Verify structural configurations.</p>
                <button onclick="window.location.reload()" class="text-xs font-bold text-teal-700 underline uppercase tracking-wider">Retry Connection</button>
            </div>
        `;
        console.error("Framework routing fault:", err.message);
    }
    renderFooter();
}

function renderHeader() {
    document.querySelector('header')?.remove();
    
    const header = document.createElement('header');
    header.className = "sticky top-0 bg-[#F9F6F0]/90 backdrop-blur-md border-b border-stone-200 z-40 px-6 py-4";
    
    const container = document.createElement('div');
    container.className = "max-w-6xl mx-auto flex justify-between items-center";
    
    const title = document.createElement('h1');
    title.className = "serif-title text-2xl font-bold tracking-tight text-stone-800 cursor-pointer";
    title.textContent = "the marginalia.";
    title.addEventListener('click', () => window.location.hash = '#home');
    
    const navGroup = document.createElement('div');
    navGroup.className = "flex items-center gap-4";
    
    if (GlobalState.userSession) {
        navGroup.innerHTML = `<span class="text-xs text-stone-600 font-medium">Hello, ${GlobalState.displayName}</span>`;
        if (GlobalState.userRole === 'admin' || GlobalState.userRole === 'owner') {
            const adminBtn = document.createElement('button');
            adminBtn.className = "bg-teal-700 text-white text-xs px-3 py-1.5 rounded-md font-bold uppercase tracking-wider hover:bg-teal-800 transition";
            adminBtn.textContent = "Editor Room";
            adminBtn.addEventListener('click', () => window.location.hash = '#admin');
            navGroup.appendChild(adminBtn);
        }
        const logoutBtn = document.createElement('button');
        logoutBtn.className = "border border-stone-300 text-stone-700 text-xs px-3 py-1.5 rounded-md font-bold uppercase tracking-wider hover:bg-stone-50 transition";
        logoutBtn.textContent = "Log Out";
        logoutBtn.addEventListener('click', handleLogout);
        navGroup.appendChild(logoutBtn);
    } else {
        const loginBtn = document.createElement('button');
        loginBtn.className = "bg-teal-700 text-white text-xs px-4 py-1.5 rounded-md font-bold uppercase tracking-wider hover:bg-teal-800 transition";
        loginBtn.textContent = "Access Control";
        loginBtn.addEventListener('click', UI.openAuth);
        navGroup.appendChild(loginBtn);
    }
    
    container.appendChild(title);
    container.appendChild(navGroup);
    header.appendChild(container);
    document.body.insertBefore(header, document.body.firstChild);
}

function handleSearchInput(value) {
    clearTimeout(searchDebounceTimeout);
    searchDebounceTimeout = setTimeout(() => {
        GlobalState.searchQuery = value || "";
        GlobalState.currentPage = 0;
        const workspace = document.getElementById('appWorkspace');
        if (window.location.hash === '#home' && workspace) {
            renderHome(workspace);
        }
    }, 300);
}

function renderHome(target) {
    target.innerHTML = `
        <div class="space-y-8">
            <div class="border-b border-stone-200 pb-4">
                <input type="text" id="blogSearch" placeholder="Search essays, notes, fragments..." class="w-full bg-transparent text-xl serif-title focus:outline-none placeholder-stone-400">
            </div>
            <div id="postsGrid" class="grid gap-8 md:grid-cols-2"></div>
        </div>
    `;
    
    const searchBar = document.getElementById('blogSearch');
    if (searchBar) {
        searchBar.value = GlobalState.searchQuery;
        searchBar.addEventListener('input', (e) => handleSearchInput(e.target.value));
    }
    
    const grid = document.getElementById('postsGrid');
    if (!grid) return;
    
    const currentQuery = (GlobalState.searchQuery || "").toLowerCase();
    const filtered = (GlobalState.posts || []).filter(p => {
        if (!p) return false;
        const matchedTitle = p.title ? p.title.toLowerCase().includes(currentQuery) : false;
        const matchedContent = p.content ? p.content.toLowerCase().includes(currentQuery) : false;
        return matchedTitle || matchedContent;
    });
    
    if (filtered.length === 0) {
        grid.innerHTML = `<p class="text-stone-500 text-sm italic col-span-2">No articles matched your search terms.</p>`;
        return;
    }
    
    filtered.forEach(post => {
        const article = document.createElement('article');
        article.className = "space-y-3 cursor-pointer group";
        article.innerHTML = `
            <div class="flex gap-2 items-center text-xs tracking-widest uppercase font-bold text-teal-700">
                <span>${post.tag || 'General'}</span>
                <span class="text-stone-300">&bull;</span>
                <span class="text-stone-500">${post.created_at ? new Date(post.created_at).toLocaleDateString() : ''}</span>
            </div>
            <h2 class="text-2xl font-bold text-stone-800 group-hover:text-teal-700 transition serif-title">${post.title || 'Untitled'}</h2>
            <p class="text-stone-600 text-sm leading-relaxed">${post.summary || ''}</p>
            <div class="text-xs text-stone-400 italic">By ${post.author || 'Anonymous'}</div>
        `;
        article.addEventListener('click', () => window.location.hash = `#post/${post.id}`);
        grid.appendChild(article);
    });
}

function renderPostView(target, post) {
    target.innerHTML = `
        <div class="max-w-3xl mx-auto space-y-6 py-6">
            <button id="backToIndexBtn" class="text-xs font-bold uppercase tracking-wider text-stone-500 hover:text-stone-800 transition">&larr; Return to Index</button>
            <div class="space-y-2">
                <div class="text-xs tracking-widest uppercase font-bold text-teal-700">${post.tag || 'General'} &bull; ${post.created_at ? new Date(post.created_at).toLocaleDateString() : ''}</div>
                <h1 class="text-4xl font-bold text-stone-900 serif-title leading-tight">${post.title || 'Untitled'}</h1>
                <div class="text-sm text-stone-500 italic">Authored by ${post.author || 'Anonymous'}</div>
            </div>
            <hr class="border-stone-200">
            <div class="prose prose-stone max-w-none text-stone-800 leading-relaxed space-y-4">
                ${post.content ? md.render(post.content) : ''}
            </div>
            <hr class="border-stone-200 pt-4">
            <div class="space-y-4" id="commentsSection">
                <h3 class="text-lg font-bold text-stone-800 serif-title">Discussion & Notes</h3>
                <div id="commentInteractionArea"></div>
                <div class="space-y-4 mt-4" id="commentsList">Loading notes...</div>
            </div>
        </div>
    `;
    
    document.getElementById('backToIndexBtn')?.addEventListener('click', () => window.location.hash = '#home');
    
    const interactArea = document.getElementById('commentInteractionArea');
    if (interactArea) {
        if (GlobalState.userSession) {
            interactArea.innerHTML = `
                <div class="space-y-2">
                    <textarea id="newComment" placeholder="Leave a notation or response..." class="w-full p-3 border border-stone-200 rounded-md text-sm focus:outline-none focus:border-stone-400 h-20 bg-stone-50"></textarea>
                    <button id="submitCommentBtn" class="bg-stone-800 text-white text-xs px-4 py-2 rounded font-bold uppercase tracking-wider hover:bg-stone-900 transition">Post Comment</button>
                </div>
            `;
            document.getElementById('submitCommentBtn')?.addEventListener('click', () => submitComment(post.id));
        } else {
            interactArea.innerHTML = `<p class="text-xs text-stone-500 italic">Please use <span id="authLinkTrigger" class="text-teal-700 font-bold cursor-pointer">Access Control</span> to sign in to leave comments.</p>`;
            document.getElementById('authLinkTrigger')?.addEventListener('click', UI.openAuth);
        }
    }
    
    loadComments(post.id);
}

function renderAdminRoom(target) {
    target.innerHTML = `
        <div class="max-w-3xl mx-auto space-y-6">
            <h2 class="text-3xl font-bold text-stone-900 serif-title">The Editor Room</h2>
            <div class="space-y-4 bg-white p-6 border border-stone-200 rounded-xl shadow-sm">
                <div class="grid gap-4 md:grid-cols-2">
                    <div>
                        <label class="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">Essay Title</label>
                        <input type="text" id="postTitle" class="w-full border border-stone-200 rounded p-2 text-sm focus:outline-none focus:border-stone-400">
                    </div>
                    <div>
                        <label class="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">Tag / Category</label>
                        <input type="text" id="postTag" placeholder="e.g. Poetry, Criticism, Notes" class="w-full border border-stone-200 rounded p-2 text-sm focus:outline-none focus:border-stone-400">
                    </div>
                </div>
                <div class="grid gap-4 md:grid-cols-2">
                    <div>
                        <label class="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">Author Name</label>
                        <input type="text" id="postAuthor" value="${GlobalState.displayName}" class="w-full border border-stone-200 rounded p-2 text-sm focus:outline-none focus:border-stone-400">
                    </div>
                    <div>
                        <label class="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">Brief Summary Excerpt</label>
                        <input type="text" id="postSummary" class="w-full border border-stone-200 rounded p-2 text-sm focus:outline-none focus:border-stone-400">
                    </div>
                </div>
                <div>
                    <label class="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">Markdown Body Content</label>
                    <textarea id="postContent" class="w-full border border-stone-200 rounded p-3 text-sm focus:outline-none focus:border-stone-400 h-64 font-mono"></textarea>
                </div>
                <button id="compilePostBtn" class="w-full bg-teal-700 text-white font-bold text-xs uppercase tracking-widest py-3 rounded-lg hover:bg-teal-800 transition">Compile to Cloud Engine</button>
            </div>
        </div>
    `;
    document.getElementById('compilePostBtn')?.addEventListener('click', compilePost);
}

function renderFooter() {
    document.querySelector('footer')?.remove();
    const footer = document.createElement('footer');
    footer.className = "border-t border-stone-200 bg-stone-100 py-6 text-center text-xs text-stone-500 mt-auto";
    footer.innerHTML = `&copy; 2026 The Marginalia Hub. Structured Architectural Engine.`;
    document.body.appendChild(footer);
}

async function handleLogin() {
    const email = document.getElementById('authEmail')?.value;
    const password = document.getElementById('authPassword')?.value;
    if (!email || !password) return alert("Credentials empty.");
    
    try {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.hash = '#home';
        window.location.reload();
    } catch (err) {
        alert(`Authentication fault: ${err.message}`);
    }
}

async function handleRegister() {
    const name = document.getElementById('authName')?.value;
    const email = document.getElementById('authEmail')?.value;
    const password = document.getElementById('authPassword')?.value;
    if (!name || !email || !password) return alert("Please fill all deployment parameters.");
    
    try {
        const { error } = await supabaseClient.auth.signUp({
            email, password, options: { data: { display_name: name } }
        });
        if (error) throw error;
        alert("Registration sequence initialized. Please verify your email inbox account credentials.");
    } catch (err) {
        alert(`Registration fault: ${err.message}`);
    }
}

async function handleLogout() {
    await supabaseClient.auth.signOut();
    window.location.hash = '#home';
    window.location.reload();
}

async function compilePost() {
    const title = document.getElementById('postTitle')?.value;
    const tag = document.getElementById('postTag')?.value;
    const author = document.getElementById('postAuthor')?.value;
    const summary = document.getElementById('postSummary')?.value;
    const content = document.getElementById('postContent')?.value;
    
    if (!title || !content) return alert("Title and Content elements are mandatory structural requirements.");
    
    try {
        const { error } = await supabaseClient.from('posts').insert([{ title, tag, author, summary, content }]);
        if (error) throw error;
        alert("Essay state compiled directly into server system nodes.");
        window.location.hash = '#home';
    } catch (err) {
        alert(`Compilation Error: ${err.message}`);
    }
}

async function loadComments(postId) {
    const listNode = document.getElementById('commentsList');
    if (!listNode) return;
    
    try {
        const { data, error } = await supabaseClient.from('comments').select('*').eq('post_id', postId).order('created_at', { ascending: true });
        if (error) throw error;
        
        if (!data || data.length === 0) {
            listNode.innerHTML = `<p class="text-stone-400 text-xs italic">No entries yet. Leave the first notation below.</p>`;
            return;
        }
        
        let html = '';
        data.forEach(c => {
            html += `
                <div class="bg-stone-50 border border-stone-200 p-3 rounded-md text-sm space-y-1">
                    <div class="flex justify-between items-center text-xs text-stone-400">
                        <span class="font-bold text-stone-600">${c.author_name || 'Anonymous'}</span>
                        <span>${c.created_at ? new Date(c.created_at).toLocaleDateString() : ''}</span>
                    </div>
                    <p class="text-stone-700">${c.content || ''}</p>
                </div>
            `;
        });
        listNode.innerHTML = html;
    } catch (err) {
        listNode.innerHTML = `<p class="text-xs text-red-500">Failed to render responses correctly.</p>`;
    }
}

async function submitComment(postId) {
    const textarea = document.getElementById('newComment');
    if (!textarea || !textarea.value.trim()) return;
    const content = textarea.value.trim();
    
    try {
        const { error } = await supabaseClient.from('comments').insert([
            { post_id: postId, content, author_name: GlobalState.displayName, user_id: GlobalState.userSession?.user?.id }
        ]);
        if (error) throw error;
        textarea.value = '';
        loadComments(postId);
    } catch (err) {
        alert(`Comment failure context: ${err.message}`);
    }
}
