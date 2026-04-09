// This file runs in the browser context (frontend)

document.addEventListener('DOMContentLoaded', () => {
    const navButtons = document.querySelectorAll('.nav-btn');
    const appView = document.getElementById('app-view');

    // Function to load a page into the main view
    async function loadPage(pageName) {
        try {
            // Fetch the HTML file from the pages directory
            const response = await fetch(`pages/${pageName}`);
            
            if (!response.ok) {
                throw new Error(`Failed to load ${pageName}`);
            }

            const html = await response.text();
            
            // Inject the HTML into our viewing area
            appView.innerHTML = html;
        } catch (error) {
            console.error('Error loading page:', error);
            appView.innerHTML = `<div class="page-container"><h2>Error Loading Tool</h2><p>Could not load ${pageName}. Ensure the file exists in the src/pages folder.</p></div>`;
        }
    }

    // Add click listeners to all sidebar buttons
    navButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            // Remove active class from all
            navButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
            e.target.classList.add('active');

            // Get the target HTML file name from the data attribute
            const targetPage = e.target.getAttribute('data-target');
            
            // Load the page
            loadPage(targetPage);
        });
    });

    // Load the home page by default when the app starts
    loadPage('home.html');
});