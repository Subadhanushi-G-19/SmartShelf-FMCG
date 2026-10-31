const API_URL = 'http://localhost:3000/api';

// Tab switching
document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        
        // Update active tab
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Show corresponding form
        document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
        document.getElementById(`${tabName}Form`).classList.add('active');
        
        // Clear errors
        document.getElementById('loginError').textContent = '';
        document.getElementById('registerError').textContent = '';
    });
});

// Login form
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Logging in...</span>';
    
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('currentUser', JSON.stringify(data.user));
            
            // Show success animation
            submitBtn.innerHTML = '<span>Success! Redirecting...</span>';
            
            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = '/dashboard.html';
            }, 500);
        } else {
            errorDiv.textContent = data.message;
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Login</span><span class="btn-icon">→</span>';
        }
    } catch (error) {
        errorDiv.textContent = 'Login failed. Please try again.';
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Login</span><span class="btn-icon">→</span>';
    }
});

// Register form
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('regUsername').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const errorDiv = document.getElementById('registerError');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Creating account...</span>';
    
    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('currentUser', JSON.stringify(data.user));
            
            submitBtn.innerHTML = '<span>Success! Redirecting...</span>';
            
            setTimeout(() => {
                window.location.href = '/dashboard.html';
            }, 500);
        } else {
            errorDiv.textContent = data.message;
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Create Account</span><span class="btn-icon">→</span>';
        }
    } catch (error) {
        errorDiv.textContent = 'Registration failed. Please try again.';
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Create Account</span><span class="btn-icon">→</span>';
    }
});

// Check if already logged in
if (localStorage.getItem('authToken')) {
    window.location.href = '/dashboard.html';
}