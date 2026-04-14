// This file runs in the browser context (frontend shell)

document.addEventListener('DOMContentLoaded', () => {

    // --- GLOBAL THEME TOGGLE LOGIC ---
    const themeLightBtn = document.getElementById('globalThemeLightBtn');
    const themeDarkBtn = document.getElementById('globalThemeDarkBtn');

    function setTheme(theme) {
        if (theme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
            if(themeLightBtn) themeLightBtn.classList.add('active');
            if(themeDarkBtn) themeDarkBtn.classList.remove('active');
        } else {
            document.documentElement.removeAttribute('data-theme');
            if(themeDarkBtn) themeDarkBtn.classList.add('active');
            if(themeLightBtn) themeLightBtn.classList.remove('active');
        }
        // Save preference globally
        localStorage.setItem('app_theme', theme);
    }

    if(themeLightBtn) themeLightBtn.addEventListener("click", () => setTheme('light'));
    if(themeDarkBtn) themeDarkBtn.addEventListener("click", () => setTheme('dark'));

    // Load saved theme on startup
    const savedTheme = localStorage.getItem('app_theme') || 'dark';
    setTheme(savedTheme);
    // ---------------------------------

    const navButtons = document.querySelectorAll('.nav-btn');
    const appView = document.getElementById('app-view');
    const pageCache = {};

    async function loadPage(pageName) {
        try {
            Object.values(pageCache).forEach(pageElement => {
                pageElement.style.display = 'none';
            });

            if (pageCache[pageName]) {
                pageCache[pageName].style.display = 'block';
                return;
            }

            const response = await fetch(`pages/${pageName}`);
            
            if (!response.ok) {
                throw new Error(`Failed to load ${pageName}`);
            }

            const html = await response.text();
            
            const pageContainer = document.createElement('div');
            pageContainer.className = 'page-container';
            pageContainer.style.width = '100%';
            pageContainer.style.height = '100%';
            pageContainer.innerHTML = html;

            pageCache[pageName] = pageContainer;
            appView.appendChild(pageContainer);

            const scripts = pageContainer.querySelectorAll('script');
            scripts.forEach(oldScript => {
                const newScript = document.createElement('script');
                Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                newScript.appendChild(document.createTextNode(oldScript.innerHTML));
                oldScript.parentNode.replaceChild(newScript, oldScript);
            });

        } catch (error) {
            console.error('Error loading page:', error);
            const errorContainer = document.createElement('div');
            errorContainer.className = 'page-container';
            errorContainer.innerHTML = `<h2>Error Loading Tool</h2><p>Could not load ${pageName}.</p>`;
            appView.appendChild(errorContainer);
        }
    }

    navButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            navButtons.forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            const targetPage = e.target.getAttribute('data-target');
            loadPage(targetPage);
        });
    });

    loadPage('home.html');
});