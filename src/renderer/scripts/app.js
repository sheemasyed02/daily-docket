class AppManager {
    constructor() {
        this.themeManager = new ThemeManager();
        this.dateManager = new DateManager();
        this.quoteManager = new QuoteManager();
        this.init();
    }

    init() {
        this.setupThemeToggle();
        this.setupDateDisplay();
        this.setupQuoteRotation();
        this.setupToasts();
    }

    setupThemeToggle() {
        const themeToggle = document.createElement('button');
        themeToggle.className = 'btn-icon theme-toggle';
        themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
          const themeToggleContainer = document.querySelector('.theme-toggle');
        const existingToggle = themeToggleContainer?.querySelector('button');
        if (existingToggle) {
            existingToggle.remove();
        }
        themeToggleContainer?.appendChild(themeToggle);
        
        themeToggle.addEventListener('click', () => {
            this.themeManager.toggleTheme();
            themeToggle.innerHTML = document.body.classList.contains('theme-dark') 
                ? '<i class="fas fa-sun"></i>' 
                : '<i class="fas fa-moon"></i>';
        });
    }

    setupDateDisplay() {
        const dateDisplay = document.querySelector('.date-display');
        if (dateDisplay) {
            dateDisplay.innerHTML = this.dateManager.getFormattedDate();
        }
    }

    setupQuoteRotation() {
        const quoteContent = document.querySelector('.quote-content');
        if (quoteContent) {
            this.quoteManager.displayRandomQuote(quoteContent);
            // Rotate quotes every 6 hours
            setInterval(() => {
                this.quoteManager.displayRandomQuote(quoteContent);
            }, 6 * 60 * 60 * 1000);
        }
    }

    setupToasts() {
        const toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
}

class ThemeManager {
    constructor() {
        this.themes = ['light', 'dark', 'pastel', 'nature', 'ocean'];
        this.currentTheme = localStorage.getItem('theme') || 'light';
        this.applyTheme(this.currentTheme);
    }

    applyTheme(theme) {
        document.body.classList.remove(...this.themes.map(t => `theme-${t}`));
        document.body.classList.add(`theme-${theme}`);
        localStorage.setItem('theme', theme);
    }

    toggleTheme() {
        const currentIndex = this.themes.indexOf(this.currentTheme);
        const nextTheme = this.themes[(currentIndex + 1) % this.themes.length];
        this.currentTheme = nextTheme;
        this.applyTheme(nextTheme);
    }
}

class DateManager {
    getFormattedDate() {
        const date = new Date();
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        return date.toLocaleDateString('en-US', options);
    }
}

class QuoteManager {
    constructor() {
        this.quotes = [
            { text: "Make each day your masterpiece.", author: "John Wooden" },
            { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
            { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
            { text: "The future depends on what you do today.", author: "Mahatma Gandhi" },
            { text: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe" },
            { text: "Don't count the days, make the days count.", author: "Muhammad Ali" },
            { text: "Every moment is a fresh beginning.", author: "T.S. Eliot" },
            { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" }
        ];
    }

    getRandomQuote() {
        return this.quotes[Math.floor(Math.random() * this.quotes.length)];
    }

    displayRandomQuote(element) {
        const quote = this.getRandomQuote();
        element.innerHTML = `
            <i class="fas fa-quote-left"></i>
            <p>${quote.text}</p>
            <small>- ${quote.author}</small>
        `;
    }
}

// Initialize the app
window.appManager = new AppManager();