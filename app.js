const SUPABASE_URL = "https://zkpsgotkjlwroklhdmnc.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprcHNnb3Rramx3cm9rbGhkbW5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MTk1NDAsImV4cCI6MjA5NzI5NTU0MH0.7dO2BJbqgRo7jPFq9bueO2ZDKogoMDYsABnTqjAuWbM"; 

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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

window.addEventListener('DOMContentLoaded', async () => {
    const { data } = await supabase.auth.getSession();
    await updateSessionState(data.session);

    supabase.auth.onAuthStateChange(async (_event, session) => {
        await updateSessionState(session);
        Router.resolve();
    });

    window.addEventListener('hashchange', () => Router.resolve());
    
    await DB.fetchPostsPage(0);
    Router.resolve();
});

async function updateSessionState(session) {
    GlobalState.userSession = session;
    if (session) {
        const { data } = await supabase
            .from('user_profiles')
            .select('role, display_name')
            .eq('id', session.user.id)
            .single();
        if (data) {
            GlobalState.userRole = data.role;
            GlobalState.displayName = data.display_name;
        }
    } else {
        GlobalState.userRole = 'reader';
        GlobalState.displayName = '';
    }
}

const DB = {
    async fetchPostsPage(page = 0, prepend = false) {
        const from = page * GlobalState.pageSize;
        const to = from + GlobalState.pageSize - 1;

        let { data, error } = await supabase
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) return UI.showSystemError("Failed to sync production database posts ledger.", error.message);

        GlobalState.hasMorePosts = data.length === GlobalState.pageSize;
        GlobalState.posts = prepend ? [...data, ...GlobalState.posts] : [...GlobalState.posts, ...data];
        GlobalState.currentPage = page;
    },
    async createPost(payload) {
        const { error } = await supabase.from('posts').insert([payload]);
        if (error) throw new Error(error.message);
    },
    async updatePost(id, payload) {
        const { error } = await supabase.from('posts').update(payload).eq('id', id);
        if (error) throw new Error(error.message);
    },
    async deletePost(id) {
        const { error } = await supabase.from('posts').delete().eq('id', id);
        if (error) throw new Error(error.message);
    },
    async fetchComments(postId) {
        let { data, error } = await supabase.from('comments').select('*').eq('post_id', postId).order('created_at', { ascending: true });
        if (error) throw new Error(error.message);
        return data || [];
    },
    async addComment(postId, body, parentId = null) {
        if (!GlobalState.userSession) return alert("You must sign in to leave a comment.");
        const payload = { post_id: postId, body: body, parent_id: parentId, author_name: GlobalState.displayName || "Anonymous Scholar" };
        const { error } = await supabase.from('comments').insert([payload]);
        if (error) throw new Error(error.message);
    }
};

const Router = {
    resolve() {
        const hash = window.location.hash || '#home';
        const workspace = document.getElementById('appWorkspace');
        const searchBar = document.getElementById('searchBarContainer');
        UI.renderHeaderControls();

        if (!hash || hash === '#home') {
            if(searchBar) searchBar.classList.remove('hidden');
            UI.initHomepage(workspace);
        } else {
            if(searchBar) searchBar.classList.add('hidden');
            
            if (hash.startsWith('#post?id=')) {
                UI.initArticleView(workspace, hash.split('=')[1]);
            } else if (hash === '#admin') {
                UI.initAdminView(workspace);
            } else if (hash.startsWith('#edit?id=')) {
                UI.initAdminView(workspace, hash.split('=')[1]);
            } else if (hash === '#auth') {
                UI.initAuthView(workspace);
            }
        }
    }
};

const UI = {
    sanitize(input) { return DOMPurify.sanitize(input); },
    escape(str) { return str ? str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m])) : ''; },
    showShimmerGrid() {
        const grid = document.getElementById('gridTarget'); if (!grid) return;
        grid.innerHTML = Array(3).fill(0).map(() => `<div class="bg-white border p-6 rounded-2xl space-y-4 shadow-sm"><div class="h-4 w-1/4 shimmer rounded"></div><div class="h-6 w-3/4 shimmer rounded"></div><div class="h-16 w-full shimmer rounded"></div></div>`).join('');
    },
    showSystemError(ctx, msg) {
        document.getElementById('appWorkspace').innerHTML = `<div class="max-w-md mx-auto p-6 bg-red-50 border border-red-200 rounded-xl text-center space-y-2"><h3 class="font-bold text-red-800 text-lg">System Exception</h3><p class="text-xs text-red-600 font-semibold">${UI.escape(ctx)}</p><p class="text-xs text-red-500 font-mono">${UI.escape(msg)}</p></div>`;
    },
    renderHeaderControls() {
        const container = document.getElementById('headerActions'); if (!container) return;
        if (GlobalState.userSession) {
            container.innerHTML = `
                ${GlobalState.userRole === 'admin' ? `<button onclick="window.location.hash = '#admin'" class="px-3 py-1.5 border bg-white border-stone-300 rounded-xl text-xs font-semibold hover:bg-stone-50 transition">Editor Room</button>` : ''}
                <button onclick="supabase.auth.signOut();" class="px-3 py-1.5 bg-stone-900 text-white text-xs font-semibold rounded-xl hover:bg-stone-800 transition">Sign Out</button>
            `;
        } else {
            container.innerHTML = `<button onclick="window.location.hash = '#auth'" class="px-3 py-1.5 bg-teal-700 text-white text-xs font-semibold rounded-xl hover:bg-teal-800 transition">Access Control</button>`;
        }
    },
    async initHomepage(target) {
        target.innerHTML = `<div class="space-y-12"><div class="border-b pb-6"><h2 class="serif-title text-4xl font-bold text-stone-900">Curated Textual Criticism</h2><p class="text-xs text-stone-500 mt-1">Enterprise CRUD Backend Environment</p></div><div id="gridTarget" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"></div><div id="paginationContainer" class="flex justify-center pt-6"></div></div>`;
        UI.renderGridCards();
    },
    
    handleSearch(query) {
        GlobalState.searchQuery = query.trim().toLowerCase();
        UI.renderGridCards();
    },

    renderGridCards() {
        const grid = document.getElementById('gridTarget'); if (!grid) return;
        
        const filtered = GlobalState.posts.filter(post => {
            const matchesSearch = 
                post.title.toLowerCase().includes(GlobalState.searchQuery) ||
                post.excerpt.toLowerCase().includes(GlobalState.searchQuery) ||
                post.tag.toLowerCase().includes(GlobalState.searchQuery);
            return matchesSearch;
        });

        if (filtered.length === 0) {
            grid.innerHTML = `<p class="text-sm text-stone-500 py-6 col-span-full text-center">No essays match your search criteria.</p>`; 
            document.getElementById('paginationContainer').innerHTML = '';
            return; 
        }

        grid.innerHTML = filtered.map(post => `
            <div class="bg-white border rounded-2xl p-6 flex flex-col justify-between shadow-sm group relative">
                <div class="space-y-2">
                    <span onclick="document.getElementById('globalSearch').value='${UI.escape(post.tag)}'; UI.handleSearch('${UI.escape(post.tag)}')" class="text-[10px] font-bold tracking-wider uppercase text-teal-700 cursor-pointer hover:underline">${UI.escape(post.tag)}</span>
                    <h3 class="serif-title text-xl font-bold hover:text-teal-700 transition"><a href="#post?id=${post.id}">${UI.escape(post.title)}</a></h3>
                    <p class="text-xs text-stone-600 line-clamp-3">${UI.escape(post.excerpt)}</p>
                </div>
                <div class="flex justify-between items-center border-t pt-3 mt-4 text-[11px] text-stone-400">
                    <span>By ${UI.escape(post.author)}</span>
                    ${GlobalState.userRole === 'admin' ? `<div class="flex space-x-2"><button onclick="window.location.hash='#edit?id=${post.id}'" class="text-teal-600 font-bold hover:underline">Edit</button><button onclick="UI.handleDeletePost(${post.id})" class="text-red-600 font-bold hover:underline">Delete</button></div>` : ''}
                </div>
            </div>
        `).join('');
        
        if (GlobalState.searchQuery !== "") {
            document.getElementById('paginationContainer').innerHTML = '';
        } else {
            document.getElementById('paginationContainer').innerHTML = GlobalState.hasMorePosts ? `<button onclick="UI.handleLoadMore()" class="px-5 py-2 border bg-white hover:bg-stone-50 rounded-xl text-xs font-semibold text-stone-700 transition shadow-sm">Load More Essays &rarr;</button>` : `<span class="text-xs text-stone-400 font-medium">All database files initialized.</span>`;
        }
    },
    async handleLoadMore() { 
        UI.showShimmerGrid();
        await DB.fetchPostsPage(GlobalState.currentPage + 1); 
        UI.renderGridCards(); 
    },
    async handleDeletePost(id) {
        if (!confirm("Are you sure you want to delete this post?")) return;
        try { await DB.deletePost(id); GlobalState.posts = GlobalState.posts.filter(p => p.id !== id); UI.renderGridCards(); alert("Record deleted."); } catch (err) { alert("Error: " + err.message); }
    },
    async initArticleView(target, id) {
        let post = GlobalState.posts.find(p => p.id == id);
        if (!post) {
            let { data, error } = await supabase.from('posts').select('*').eq('id', id).single();
            if (error || !data) return UI.showSystemError("Failed to open article asset.", "Invalid target link lookup parameter.");
            post = data;
        }
        target.innerHTML = `
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-12">
                <article class="lg:col-span-8 space-y-6">
                    <div><span class="text-xs font-bold text-teal-700 uppercase">${UI.escape(post.tag)}</span><h1 class="serif-title text-4xl font-bold text-stone-900">${UI.escape(post.title)}</h1><p class="text-xs text-stone-400">Compiled by ${UI.escape(post.author)}</p></div>
                    <div class="prose prose-stone text-stone-700 leading-relaxed space-y-4">${UI.sanitize(md.render(post.content))}</div>
                    <section class="border-t pt-8 space-y-6">
                        <h3 class="serif-title text-2xl font-bold text-stone-900">Seminar Dialogue</h3>
                        <div id="commentComposeWrapper">${GlobalState.userSession ? `<form id="commentForm" class="space-y-2"><textarea id="commentInput" required rows="3" placeholder="Contribute insight..." class="w-full border rounded-xl p-3 text-sm outline-none"></textarea><button type="submit" class="px-4 py-2 bg-teal-700 text-white font-semibold text-xs uppercase rounded-xl">Submit</button></form>` : `<p class="text-xs text-stone-500 bg-stone-100 p-3 rounded-xl">Please <a href="#auth" class="text-teal-700 font-bold hover:underline">sign in</a> to comment.</p>`}</div>
                        <div id="commentsLayoutTarget" class="space-y-4 pt-4"></div>
                    </section>
                </article>
            </div>
        `;
        if (GlobalState.userSession) {
            document.getElementById('commentForm').addEventListener('submit', async (e) => {
                e.preventDefault(); const text = document.getElementById('commentInput').value;
                try { await DB.addComment(post.id, text); document.getElementById('commentInput').value = ''; await UI.loadAndRenderComments(post.id); } catch (err) { alert(err.message); }
            });
        }
        await UI.loadAndRenderComments(post.id);
    },
    async loadAndRenderComments(postId) {
        const container = document.getElementById('commentsLayoutTarget'); if (!container) return;
        try {
            const list = await DB.fetchComments(postId); if (list.length === 0) { container.innerHTML = `<p class="text-xs text-stone-400 italic">No remarks compiled yet.</p>`; return; }
            const roots = list.filter(c => !c.parent_id), replies = list.filter(c => c.parent_id);
            container.innerHTML = roots.map(root => `
                <div class="bg-white border rounded-xl p-4 space-y-2 shadow-sm">
                    <div class="flex justify-between text-xs text-stone-400 font-medium"><span class="text-stone-700 font-bold">${UI.escape(root.author_name)}</span><span>${new Date(root.created_at).toLocaleDateString()}</span></div>
                    <p class="text-sm text-stone-600">${UI.escape(root.body)}</p>
                    <div class="pl-6 border-l border-stone-200 space-y-3 mt-3">
                        ${replies.filter(rep => rep.parent_id === root.id).map(rep => `<div class="bg-stone-50 p-2 rounded-lg"><div class="flex justify-between text-[11px] text-stone-400"><span class="font-bold text-stone-600">${UI.escape(rep.author_name)}</span><span>${new Date(rep.created_at).toLocaleDateString()}</span></div><p class="text-xs text-stone-600">${UI.escape(rep.body)}</p></div>`).join('')}
                        ${GlobalState.userSession ? `<div class="pt-2"><button onclick="this.nextElementSibling.classList.toggle('hidden')" class="text-[10px] uppercase font-bold text-teal-700">↳ Reply</button><div class="hidden mt-2 space-y-1"><input type="text" placeholder="Write reply..." class="w-full text-xs border rounded-lg p-2 outline-none"><button onclick="UI.handleInlineReplySubmit(this, ${postId}, ${root.id})" class="px-2 py-1 bg-stone-800 text-white text-[10px] uppercase rounded-md">Post</button></div></div>` : ''}
                    </div>
                </div>
            `).join('');
        } catch (err) { container.innerHTML = `<p class="text-xs text-red-500">Error: ${err.message}</p>`; }
    },
    async handleInlineReplySubmit(btn, postId, parentId) {
        const input = btn.previousElementSibling; if (!input.value) return;
        try { await DB.addComment(postId, input.value, parentId); await UI.loadAndRenderComments(postId); } catch (err) { alert(err.message); }
    },
    initAdminView(target, editPostId = null) {
        if (GlobalState.userRole !== 'admin') { target.innerHTML = `<p class="text-center text-sm py-12 text-red-600 font-bold">Unauthorized Session.</p>`; return; }
        const modeData = editPostId ? GlobalState.posts.find(p => p.id == editPostId) : { title: '', tag: '', author: '', excerpt: '', content: '' };
        target.innerHTML = `
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
                <div class="bg-white p-6 border rounded-2xl shadow-sm space-y-4">
                    <h2 class="serif-title text-2xl font-bold">${editPostId ? "Modify Entry" : "Create Entry"}</h2>
                    <form id="cmsForm" class="space-y-4">
                        <input type="text" id="formTitle" required value="${UI.escape(modeData.title)}" placeholder="Title" class="w-full border rounded-xl px-4 py-2 text-sm bg-stone-50 outline-none">
                        <input type="text" id="formTag" required value="${UI.escape(modeData.tag)}" placeholder="Tag" class="w-full border rounded-xl px-4 py-2 text-sm bg-stone-50 outline-none">
                        <input type="text" id="formAuthor" required value="${UI.escape(modeData.author)}" placeholder="Author" class="w-full border rounded-xl px-4 py-2 text-sm bg-stone-50 outline-none">
                        <input type="text" id="formExcerpt" required value="${UI.escape(modeData.excerpt)}" placeholder="Summary Excerpt" class="w-full border rounded-xl px-4 py-2 text-sm bg-stone-50 outline-none">
                        <textarea id="formContent" required rows="10" placeholder="Markdown supported..." class="w-full border rounded-xl p-3 text-sm font-mono bg-stone-50 outline-none">${UI.escape(modeData.content)}</textarea>
                        <button type="submit" class="w-full py-3 bg-teal-700 text-white font-bold text-xs uppercase rounded-xl">${editPostId ? "Save Changes" : "Compile to Cloud"}</button>
                    </form>
                </div>
                <div class="bg-white p-6 border rounded-2xl shadow-sm space-y-4 flex flex-col"><h4 class="text-[10px] font-bold tracking-wider text-stone-400 uppercase border-b pb-2">Active Live Preview</h4><div id="composerPreview" class="prose prose-stone text-stone-700 max-w-none flex-1 overflow-y-auto max-h-[500px] space-y-4"></div></div>
            </div>
        `;
        const textarea = document.getElementById('formContent'), preview = document.getElementById('composerPreview');
        const updatePreview = () => { preview.innerHTML = UI.sanitize(md.render(textarea.value || '*No content yet...*')); };
        textarea.addEventListener('input', updatePreview); updatePreview();
        document.getElementById('cmsForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                title: document.getElementById('formTitle').value, tag: document.getElementById('formTag').value, author: document.getElementById('formAuthor').value, excerpt: document.getElementById('formExcerpt').value, content: textarea.value,
                slug: document.getElementById('formTitle').value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
            };
            try {
                if (editPostId) { await DB.updatePost(editPostId, payload); alert("Changes updated!"); }
                else { await DB.createPost(payload); alert("Article compiled!"); }
                GlobalState.posts = []; window.location.hash = '#home';
            } catch (err) { alert("CMS failure: " + err.message); }
        });
    },
    initAuthView(target) {
        target.innerHTML = `
            <div class="max-w-sm mx-auto bg-white p-8 border rounded-2xl shadow-sm space-y-4">
                <h3 class="serif-title text-xl font-bold text-center">Secure Cloud Access</h3>
                <input type="text" id="authName" placeholder="Display Name (For Sign Up)" class="w-full border rounded-xl px-4 py-2 text-sm bg-stone-50">
                <input type="email" id="authEmail" placeholder="Email Address" class="w-full border rounded-xl px-4 py-2 text-sm bg-stone-50">
                <input type="password" id="authPassword" placeholder="Password" class="w-full border rounded-xl px-4 py-2 text-sm bg-stone-50">
                <div class="flex gap-2 pt-2">
                    <button onclick="UI.handleLogin()" class="w-1/2 py-2 bg-teal-700 text-white font-bold text-xs uppercase rounded-xl">Log In</button>
                    <button onclick="UI.handleRegister()" class="w-1/2 border border-stone-300 text-stone-700 font-bold text-xs uppercase rounded-xl">Register</button>
                </div>
            </div>
        `;
    },
    async handleLogin() {
        const { error } = await supabase.auth.signInWithPassword({ email: document.getElementById('authEmail').value, password: document.getElementById('authPassword').value });
        if (error) alert(error.message); else window.location.hash = '#home';
    },
   async handleRegister() {
        const name = document.getElementById('authName').value; if (!name) return alert("Please clarify a name.");
        const { error } = await supabase.auth.signUp({ email: document.getElementById('authEmail').value, password: document.getElementById('authPassword').value, options: { data: { display_name: name } } });
        if (error) alert(error.message); else alert("Registration check sent! Please check your email inbox to verify your account.");
    }
};

window.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    GlobalState.userSession = session;
    if (session) {
        GlobalState.displayName = session.user.user_metadata.display_name || 'Admin';
        const { data } = await supabase.from('user_profiles').select('role').eq('id', session.user.id).single();
        if (data) GlobalState.userRole = data.role;
    }
    
    window.addEventListener('hashchange', router);
    router();
});

async function router() {
    const hash = window.location.hash || '#home';
    const workspace = document.getElementById('appWorkspace');
    if (!workspace) return;
    
    // Clear view state
    workspace.innerHTML = '';
    renderHeader();
    
    if (hash === '#home') {
        const { data, error } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
        if (!error) GlobalState.posts = data || [];
        renderHome(workspace);
    } else if (hash.startsWith('#post/')) {
        const id = hash.split('/')[1];
        const { data } = await supabase.from('posts').select('*').eq('id', id).single();
        if (data) renderPostView(workspace, data);
    } else if (hash === '#admin' && (GlobalState.userRole === 'admin' || GlobalState.userRole === 'owner')) {
        renderAdminRoom(workspace);
    } else {
        window.location.hash = '#home';
    }
    renderFooter();
}

function renderHeader() {
    let existingNode = document.querySelector('header');
    if (existingNode) existingNode.remove();
    
    const header = document.createElement('header');
    header.className = "sticky top-0 bg-[#F9F6F0]/90 backdrop-blur-md border-b border-stone-200 z-40 px-6 py-4";
    header.innerHTML = `
        <div class="max-w-6xl mx-auto flex justify-between items-center">
            <h1 class="serif-title text-2xl font-bold tracking-tight text-stone-800 cursor-pointer" onclick="window.location.hash='#home'">the marginalia.</h1>
            <div class="flex items-center gap-4">
                ${GlobalState.userSession ? `
                    <span class="text-xs text-stone-600 font-medium">Hello, ${GlobalState.displayName}</span>
                    ${(GlobalState.userRole === 'admin' || GlobalState.userRole === 'owner') ? `<button onclick="window.location.hash='#admin'" class="bg-teal-700 text-white text-xs px-3 py-1.5 rounded-md font-bold uppercase tracking-wider hover:bg-teal-800 transition">Editor Room</button>` : ''}
                    <button onclick="handleLogout()" class="border border-stone-300 text-stone-700 text-xs px-3 py-1.5 rounded-md font-bold uppercase tracking-wider hover:bg-stone-50 transition">Log Out</button>
                ` : `
                    <button onclick="UI.openAuth()" class="bg-teal-700 text-white text-xs px-4 py-1.5 rounded-md font-bold uppercase tracking-wider hover:bg-teal-800 transition">Access Control</button>
                `}
            </div>
        </div>
    `;
    document.body.insertBefore(header, document.body.firstChild);
}

function renderFooter() {
    let existingNode = document.querySelector('footer');
    if (existingNode) existingNode.remove();
    
    const footer = document.createElement('footer');
    footer.className = "border-t border-stone-200 bg-stone-100 py-6 text-center text-xs text-stone-500 mt-auto";
    footer.innerHTML = `&copy; 2026 The Marginalia Hub. Structured Architectural Engine.`;
    document.body.appendChild(footer);
}

function renderHome(target) {
    let html = `
        <div class="space-y-8">
            <div class="border-b border-stone-200 pb-4">
                <input type="text" id="blogSearch" placeholder="Search essays, notes, fragments..." value="${GlobalState.searchQuery}" oninput="handleSearch(this.value)" class="w-full bg-transparent text-xl serif-title focus:outline-none placeholder-stone-400">
            </div>
            <div class="grid gap-8 md:grid-cols-2">
    `;
    
    const filtered = GlobalState.posts.filter(p => 
        p.title.toLowerCase().includes(GlobalState.searchQuery.toLowerCase()) || 
        p.content.toLowerCase().includes(GlobalState.searchQuery.toLowerCase())
    );
    
    if (filtered.length === 0) {
        html += `<p class="text-stone-500 text-sm italic col-span-2">No articles matched your search terms.</p>`;
    } else {
        filtered.forEach(post => {
            html += `
                <article class="space-y-3 cursor-pointer group" onclick="window.location.hash='#post/${post.id}'">
                    <div class="flex gap-2 items-center text-xs tracking-widest uppercase font-bold text-teal-700">
                        <span>${post.tag || 'General'}</span>
                        <span class="text-stone-300">&bull;</span>
                        <span class="text-stone-500">${new Date(post.created_at).toLocaleDateString()}</span>
                    </div>
                    <h2 class="text-2xl font-bold text-stone-800 group-hover:text-teal-700 transition serif-title">${post.title}</h2>
                    <p class="text-stone-600 text-sm leading-relaxed">${post.summary || ''}</p>
                    <div class="text-xs text-stone-400 italic">By ${post.author || 'Anonymous'}</div>
                </article>
            `;
        });
    }
    
    html += `</div></div>`;
    target.innerHTML = html;
}

function renderPostView(target, post) {
    target.innerHTML = `
        <div class="max-w-3xl mx-auto space-y-6 py-6">
            <button onclick="window.location.hash='#home'" class="text-xs font-bold uppercase tracking-wider text-stone-500 hover:text-stone-800 transition">&larr; Return to Index</button>
            <div class="space-y-2">
                <div class="text-xs tracking-widest uppercase font-bold text-teal-700">${post.tag || 'General'} &bull; ${new Date(post.created_at).toLocaleDateString()}</div>
                <h1 class="text-4xl font-bold text-stone-900 serif-title leading-tight">${post.title}</h1>
                <div class="text-sm text-stone-500 italic">Authored by ${post.author || 'Anonymous'}</div>
            </div>
            <hr class="border-stone-200">
            <div class="prose prose-stone max-w-none text-stone-800 leading-relaxed space-y-4">
                ${md.render(post.content)}
            </div>
            
            <hr class="border-stone-200 pt-4">
            <div class="space-y-4" id="commentsSection">
                <h3 class="text-lg font-bold text-stone-800 serif-title">Discussion & Notes</h3>
                ${GlobalState.userSession ? `
                    <div class="space-y-2">
                        <textarea id="newComment" placeholder="Leave a notation or response..." class="w-full p-3 border border-stone-200 rounded-md text-sm focus:outline-none focus:border-stone-400 h-20 bg-stone-50"></textarea>
                        <button onclick="submitComment('${post.id}')" class="bg-stone-800 text-white text-xs px-4 py-2 rounded font-bold uppercase tracking-wider hover:bg-stone-900 transition">Post Comment</button>
                    </div>
                ` : `<p class="text-xs text-stone-500 italic">Please use <span class="text-teal-700 font-bold cursor-pointer" onclick="UI.openAuth()">Access Control</span> to sign in to leave comments.</p>`}
                <div class="space-y-4 mt-4" id="commentsList">Loading notes...</div>
            </div>
        </div>
    `;
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
                <button onclick="compilePost()" class="w-full bg-teal-700 text-white font-bold text-xs uppercase tracking-widest py-3 rounded-lg hover:bg-teal-800 transition">Compile to Cloud Engine</button>
            </div>
        </div>
    `;
}

function handleSearch(val) {
    GlobalState.searchQuery = val;
    const workspace = document.getElementById('appWorkspace');
    if (window.location.hash === '#home' && workspace) {
        renderHome(workspace);
    }
}

async function handleLogout() {
    await supabase.auth.signOut();
    window.location.reload();
}

async function compilePost() {
    const title = document.getElementById('postTitle').value;
    const tag = document.getElementById('postTag').value;
    const author = document.getElementById('postAuthor').value;
    const summary = document.getElementById('postSummary').value;
    const content = document.getElementById('postContent').value;
    
    if(!title || !content) return alert("Title and Content fields are required.");
    
    const { error } = await supabase.from('posts').insert([{ title, tag, author, summary, content }]);
    if (error) alert(error.message);
    else {
        alert("Essay compiled successfully!");
        window.location.hash = '#home';
    }
}

async function loadComments(postId) {
    const listNode = document.getElementById('commentsList');
    if (!listNode) return;
    const { data, error } = await supabase.from('comments').select('*').eq('post_id', postId).order('created_at', { ascending: true });
    if (error) {
        listNode.innerHTML = `<p class="text-xs text-red-500">Failed to render responses.</p>`;
        return;
    }
    if (data.length === 0) {
        listNode.innerHTML = `<p class="text-stone-400 text-xs italic">No entries yet. Leave the first notation below.</p>`;
        return;
    }
    let html = '';
    data.forEach(c => {
        html += `
            <div class="bg-stone-50 border border-stone-200 p-3 rounded-md text-sm space-y-1">
                <div class="flex justify-between items-center text-xs text-stone-400">
                    <span class="font-bold text-stone-600">${c.author_name}</span>
                    <span>${new Date(c.created_at).toLocaleDateString()}</span>
                </div>
                <p class="text-stone-700">${c.content}</p>
            </div>
        `;
    });
    listNode.innerHTML = html;
}

async function submitComment(postId) {
    const textarea = document.getElementById('newComment');
    if (!textarea || !textarea.value.trim()) return;
    const content = textarea.value.trim();
    
    const { error } = await supabase.from('comments').insert([
        { post_id: postId, content, author_name: GlobalState.displayName, user_id: GlobalState.userSession.user.id }
    ]);
    
    if (error) alert(error.message);
    else {
        textarea.value = '';
        loadComments(postId);
    }
}
