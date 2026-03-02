async function handleLogin(e) {
    if (e) e.preventDefault();

    const email = $('#username').val(); // Using email as username
    const password = $('#password').val();

    if (!email || !password) {
        Swal.fire('Incomplete Data', 'Please fill in your email and password.', 'warning');
        return;
    }

    // Show Loading
    Swal.fire({
        title: 'Verifying with Supabase...',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        // Use Supabase Auth for real security
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        Swal.close();

        if (error) {
            Swal.fire({
                icon: 'error',
                title: 'Access Denied',
                text: 'Wrong Email or Password! (Supabase Error: ' + error.message + ')',
                showConfirmButton: true
            });
        } else {
            // Success! Supabase handles the session automatically in its SDK
            localStorage.setItem('isAdminLoggedIn', 'true'); // Keep for legacy UI checks if needed

            Swal.fire({
                icon: 'success',
                title: 'Admin Login Successful!',
                text: 'Redirecting to Admin Panel...',
                timer: 1500,
                showConfirmButton: false
            }).then(() => {
                window.location.href = 'Admin.html';
            });
        }
    } catch (err) {
        Swal.close();
        Swal.fire('Error', 'Connection failed: ' + err.message, 'error');
    }
}