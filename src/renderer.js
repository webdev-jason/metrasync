document.addEventListener('DOMContentLoaded', () => {
    const navButtons = document.querySelectorAll('.nav-btn');
    const appView = document.getElementById('app-view');

    async function loadPage(pageName) {
        try {
            const response = await fetch(`pages/${pageName}`);
            
            if (!response.ok) {
                throw new Error(`Failed to load ${pageName}`);
            }

            const html = await response.text();
            appView.innerHTML = html;

            // Plug-and-Play Script Loader
            const scriptName = pageName.replace('.html', '.js');
            try {
                // Dynamically import the script module
                const module = await import(`./pages/${scriptName}`);
                // If the module exports an init() function, run it
                if (module.init) module.init();
            } catch (err) {
                // Fails silently for pages without scripts (like home.html)
                console.log(`No script loaded for ${pageName}`);
            }

        } catch (error) {
            console.error('Error loading page:', error);
            appView.innerHTML = `<div class="page-container"><h2>Error Loading Tool</h2><p>Could not load ${pageName}.</p></div>`;
        }
    }

    navButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            navButtons.forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            loadPage(e.target.getAttribute('data-target'));
        });
    });

    loadPage('home.html');
});