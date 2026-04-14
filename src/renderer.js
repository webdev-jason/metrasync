// This file runs in the browser context (frontend shell)

document.addEventListener('DOMContentLoaded', () => {
    const navButtons = document.querySelectorAll('.nav-btn');
    const appView = document.getElementById('app-view');

    // CORE UPGRADE: DOM Caching
    // We store loaded pages in this object so we don't destroy them when switching tabs
    const pageCache = {};

    async function loadPage(pageName) {
        try {
            // 1. Hide all currently visible pages in the app view
            Object.values(pageCache).forEach(pageElement => {
                pageElement.style.display = 'none';
            });

            // 2. If we have already loaded this page, just unhide it! (No script crashing)
            if (pageCache[pageName]) {
                pageCache[pageName].style.display = 'block';
                return;
            }

            // 3. If it is the first time visiting this tab, fetch the HTML
            const response = await fetch(`pages/${pageName}`);
            
            if (!response.ok) {
                throw new Error(`Failed to load ${pageName}`);
            }

            const html = await response.text();
            
            // 4. Create a dedicated, permanent container for this specific tool
            const pageContainer = document.createElement('div');
            pageContainer.className = 'page-container';
            pageContainer.style.width = '100%';
            pageContainer.style.height = '100%';
            pageContainer.innerHTML = html;

            // 5. Save it to our memory cache and add it to the screen
            pageCache[pageName] = pageContainer;
            appView.appendChild(pageContainer);

            // 6. Execute scripts strictly ONCE for this tool to prevent variable collisions
            const scripts = pageContainer.querySelectorAll('script');
            scripts.forEach(oldScript => {
                const newScript = document.createElement('script');
                Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                newScript.appendChild(document.createTextNode(oldScript.innerHTML));
                oldScript.parentNode.replaceChild(newScript, oldScript);
            });

        } catch (error) {
            console.error('Error loading page:', error);
            // Graceful error handling that doesn't break the cache
            const errorContainer = document.createElement('div');
            errorContainer.className = 'page-container';
            errorContainer.innerHTML = `<h2>Error Loading Tool</h2><p>Could not load ${pageName}.</p>`;
            appView.appendChild(errorContainer);
        }
    }

    // Add click listeners to all top navigation buttons
    navButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            // Remove active class from all
            navButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
            e.target.classList.add('active');

            // Get the target HTML file name from the data attribute
            const targetPage = e.target.getAttribute('data-target');
            
            // Load or unhide the page
            loadPage(targetPage);
        });
    });

    // Load the home page by default when the app starts
    loadPage('home.html');
});