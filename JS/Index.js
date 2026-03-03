$(document).ready(function () {
    window.allWorkTypes = [];

    // --- CUSTOM LIQUID LOADER FOR SWEETALERT2 ---
    window.showCustomLoader = function (titleText) {
        return Swal.fire({
            title: titleText,
            html: `
                <div class="liquid-loader" style="margin-top: 20px;">
                    <div class="loader-track">
                        <div class="liquid-fill"></div>
                    </div>
                </div>
            `,
            showConfirmButton: false,
            allowOutsideClick: false,
            background: 'var(--card-bg)',
            color: 'var(--text-white)'
        });
    };

    // --- FETCH WORK TYPES FROM SUPABASE ---
    async function fetchAllWorkTypes(callback) {
        const { data, error } = await supabase
            .from('work_types')
            .select('*');

        if (error) {
            console.error('Work types fetch error:', error);
            return;
        }

        window.allWorkTypes = data.map(item => ({
            WorkTypeID: item.id,
            WorkTypeName: item.work_type_name,
            WorkTypeHindi: item.work_type_hindi
        }));

        // Populate selects
        if ($('#regWork').length) {
            var opts = '<option value="">Select Work</option>';
            $.each(window.allWorkTypes, function (i, item) {
                opts += `<option value="${item.WorkTypeName}">${item.WorkTypeName} (${item.WorkTypeHindi})</option>`;
            });
            $('#regWork').html(opts);
        }

        // Populate registration buttons
        if ($('#workTypeOptions').length > 0) {
            var html = '';
            $.each(window.allWorkTypes, function (i, item) {
                html += `<button type="button" class="btn-option" onclick="selectWork('${item.WorkTypeName}', this)">${item.WorkTypeHindi}</button>`;
            });
            $('#workTypeOptions').html(html);
        }

        if (callback) callback();
    }

    // --- HOMEPAGE FILTER LOGIC ---
    $('#search-icon').click(() => loadWorkers(true));

    function checkPincodeBeforeFilter() {
        const pin = $('#pincodeFilter').val().trim();
        if (pin.length !== 6) {
            Swal.fire({
                icon: 'warning',
                title: 'पिनकोड डालिये',
                text: 'कृपया पहले 6 अंकों का पिनकोड डालिये तभी आप राज्य या जिला चुन पाएंगे।',
                confirmButtonColor: '#ec4899'
            });
            return false;
        }
        return true;
    }

    $('.custom-dropdown-wrapper').on('mousedown click', function (e) {
        // Price type doesn't need pincode check
        if (this.id === 'priceTypeFilterWrapper') return true;

        if (!checkPincodeBeforeFilter()) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    });

    $('#stateFilter, #districtFilter, #villageFilter, #priceTypeFilter').change(function () {
        if ($(this).attr('id') !== 'priceTypeFilter' && !checkPincodeBeforeFilter()) {
            $(this).val(''); // Reset selection
            return;
        }
        loadWorkers(true);
    });

    $('#pincodeFilter').on('keyup', function () {
        if ($(this).val().length === 0) loadWorkers(true);
        // Removed auto-load on 6 digits to wait for Verify button
    });

    $('#btnVerifyHomePincode').click(async function (e) {
        e.stopPropagation();
        var pin = $('#pincodeFilter').val().trim();
        if (pin.length !== 6) {
            Swal.fire('त्रुटि', 'कृपया 6 अंकों का सही पिनकोड डालें।', 'error');
            return;
        }

        showCustomLoader('खोज रहे हैं...');

        try {
            const res = await fetch('https://api.postalpincode.in/pincode/' + pin);
            const response = await res.json();
            Swal.close();

            if (response[0].Status == "Success") {
                const po = response[0].PostOffice;
                const state = po[0].State;
                const district = po[0].District;

                // Update Real Selects
                $('#stateFilter').html(`<option value="">सभी राज्य</option><option value="${state}">${state}</option>`);
                $('#districtFilter').html(`<option value="">सभी जिले</option><option value="${district}">${district}</option>`);

                // Update Custom Dropout Lists
                $('#stateOptions').html(`
                    <div class="filter-option" onclick="setCustomFilter('state', '', 'सभी राज्य')">सभी राज्य</div>
                    <div class="filter-option" onclick="setCustomFilter('state', '${state}', '${state}')">${state}</div>
                `);
                $('#districtOptions').html(`
                    <div class="filter-option" onclick="setCustomFilter('dist', '', 'सभी जिले')">सभी जिले</div>
                    <div class="filter-option" onclick="setCustomFilter('dist', '${district}', '${district}')">${district}</div>
                `);

                // Update Custom Labels
                $('#selectedStateText').text(state).css('color', 'var(--text-white)');
                $('#selectedDistrictText').text(district).css('color', 'var(--text-white)');

                // Update Villages Custom List
                let vOpts = '<option value="">सभी गाँव/शहर</option>';
                let vCustomHtml = '<div class="filter-option" onclick="setCustomFilter(\'vill\', \'\', \'सभी गाँव/शहर\')">सभी गाँव/शहर</div>';

                po.forEach(item => {
                    vOpts += `<option value="${item.Name}">${item.Name}</option>`;
                    vCustomHtml += `<div class="filter-option" onclick="setCustomFilter('vill', '${item.Name}', '${item.Name}')">${item.Name}</div>`;
                });

                $('#villageFilter').html(vOpts);
                $('#villageOptions').html(vCustomHtml);

                // Reset village text
                $('#selectedVillageText').text('सभी गाँव/शहर').css('color', 'var(--text-muted)');

                loadWorkers(true);
            } else {
                Swal.fire('त्रुटि', 'गलत पिनकोड।', 'error');
            }
        } catch (err) {
            Swal.close();
            Swal.fire('Error', 'PIN API Failed', 'error');
        }
    });

    // --- WORKER LOADING LOGIC (SUPABASE) ---
    var currentPage = 1;
    var pageSize = 15;

    window.loadWorkers = async function (shouldScroll) {
        const searchTerm = $('#searchInput').val()?.trim() || "";
        const state = $('#stateFilter').val();
        const dist = $('#districtFilter').val();
        const vill = $('#villageFilter').val();
        const pin = $('#pincodeFilter').val();
        const priceT = $('#priceTypeFilter').val();

        if (searchTerm.length > 0) {
            // Real-time search: No liquid loader for small keystrokes to prevent flickering
        } else {
            $('#workersContainer').html('<div style="grid-column: 1/-1; display: flex; justify-content: center; padding: 3rem;"><div class="liquid-loader"><div class="loading-text">Loading...</div><div class="loader-track"><div class="liquid-fill"></div></div></div></div>');
        }

        let query = supabase.from('workers').select('*', { count: 'exact' }).eq('is_active', true);

        if (searchTerm) query = query.ilike('full_name', `%${searchTerm}%`);
        if (state) query = query.eq('state_name', state);
        if (dist) query = query.eq('district_name', dist);
        if (vill) query = query.eq('village_name', vill);
        if (pin) query = query.eq('pincode', pin);
        if (priceT) query = query.eq('price_type', priceT);

        // Pagination & Sorting (Sort by Rating Descending first, then latest)
        const from = (currentPage - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to)
            .order('rating', { ascending: false })
            .order('created_at', { ascending: false });

        const { data, count, error } = await query;

        if (error) {
            console.error('Load workers error:', error);
            $('#workersContainer').html('<div style="grid-column: 1/-1; text-align: center; color: red;">डेटा लोड नहीं हो पाया।</div>');
            return;
        }

        // --- PAGINATION BUTTONS VISIBILITY ---
        if (currentPage > 1) $('#btnPrevPage').show(); else $('#btnPrevPage').hide();
        if (count > (currentPage * pageSize)) $('#btnNextPage').show(); else $('#btnNextPage').hide();

        let html = '';
        if (!data || data.length === 0) {
            html = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem;">कोई वर्कर नहीं मिला।</div>';
        } else {
            data.forEach((w, i) => {
                const imgSrc = w.image_path || 'Image/default_profile.png';
                const pTypeHindi = w.price_type == 'Per Day' ? 'प्रति दिन' : 'ठेका';
                const matchedType = window.allWorkTypes.find(t => t.WorkTypeName === w.work_type);
                const wTypeDisplay = matchedType ? `${matchedType.WorkTypeHindi} (${matchedType.WorkTypeName})` : w.work_type;

                let stars = '';
                const rating = Math.round(w.rating || 0);
                for (let s = 1; s <= 5; s++) {
                    stars += `<span class="star ${s <= rating ? 'filled' : ''}" onclick="rateWorker(${w.id}, ${s})">${s <= rating ? '★' : '☆'}</span>`;
                }

                html += `
                <div id="worker-card-${w.id}" class="worker-card glass animate-fade" style="animation-delay: ${i * 0.1}s">
                    <img src="${imgSrc}" class="worker-image" alt="${w.full_name}" onerror="this.src='Image/default_profile.png'">
                    <div class="worker-info">
                        <div class="worker-name">${w.full_name}</div>
                        <div class="worker-details"><strong>काम:</strong> ${wTypeDisplay}</div>
                        <div class="worker-details"><strong>स्थान:</strong> ${w.village_name}, ${w.district_name}</div>
                        <div class="worker-price">₹ ${w.price} <span>(${pTypeHindi})</span></div>
                        <div class="rating-container">${stars} <span style="font-size:0.8em">(${w.rating_count})</span></div> 
                        <a href="tel:${w.phone}" class="call-btn" title="Call ${w.full_name}">
                            <i class="fas fa-phone"></i>
                        </a>
                    </div>
                </div>`;
            });
        }

        $('#workersContainer').html(html);
        $('#btnNextPage').toggle(count > currentPage * pageSize);
        $('#btnPrevPage').toggle(currentPage > 1);

        if (shouldScroll && data.length > 0) {
            $('html, body').animate({ scrollTop: $("#workersContainer").offset().top - 100 }, 800);
        }
    };

    // --- IMAGE COMPRESSION HELPER ---
    async function compressImage(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // Max dimensions 800px
                    const MAX_SIZE = 800;
                    if (width > height) {
                        if (width > MAX_SIZE) {
                            height *= MAX_SIZE / width;
                            width = MAX_SIZE;
                        }
                    } else {
                        if (height > MAX_SIZE) {
                            width *= MAX_SIZE / height;
                            height = MAX_SIZE;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Convert to Blob with 0.7 quality (approx 150-200kb)
                    canvas.toBlob((blob) => {
                        resolve(new File([blob], file.name, { type: 'image/jpeg' }));
                    }, 'image/jpeg', 0.7);
                };
            };
        });
    }

    // --- REGISTRATION & SAVE LOGIC (SUPABASE) ---
    async function uploadWorkerPhoto(file) {
        if (!file) return null;

        try {
            // Compress before upload
            const compressedFile = await compressImage(file);

            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
            const filePath = `photos/${fileName}`;

            // IMPORTANT: The bucket name in Supabase must match exactly.
            // If it is 'WorkersImage' in your dashboard, use that.
            // If it's returning 404, please check if the bucket is set to "Public".
            const bucketName = 'WorkersImage';

            const { data, error } = await supabase.storage
                .from(bucketName)
                .upload(filePath, compressedFile);

            if (error) {
                console.error('Upload error:', error);
                return null;
            }

            const { data: publicUrlData } = supabase.storage
                .from(bucketName)
                .getPublicUrl(filePath);

            return publicUrlData.publicUrl;
        } catch (err) {
            console.error('Image processing error:', err);
            return null;
        }
    }

    // --- SAVE ADMIN EDIT ---
    window.saveAdminEdit = async function () {
        const id = $('#workerId').val();
        if (!id) return;

        showCustomLoader('Profile is Updating...');

        let photoUrl = $('#currentImagePath').val();
        const photoFile = $('#regImage')[0].files[0];
        if (photoFile) {
            const uploadedUrl = await uploadWorkerPhoto(photoFile);
            if (uploadedUrl) photoUrl = uploadedUrl;
        }

        const workerData = {
            full_name: $('#regName').val().trim(),
            phone: $('#regPhone').val().trim(),
            email: $('#regEmail').val().trim(),
            age: parseInt($('#regAge').val()),
            work_type: $('#regWork').val(),
            price: parseFloat($('#regPrice').val()),
            price_type: $('#regPriceType').val(),
            pincode: $('#regPincode').val().trim(),
            state_name: $('#regState').val(),
            district_name: $('#regDistrict').val(),
            village_name: $('#regVillage').val(),
            image_path: photoUrl
        };

        const { error } = await supabase.from('workers').update(workerData).eq('id', id);

        if (error) {
            Swal.fire('Error', error.message, 'error');
        } else {
            await Swal.fire('Success', 'Worker profile updated successfully!', 'success');
            window.location.href = 'Admin.html';
        }
    };

    $('#btnRegister').click(async function () {
        const name = $('#regName').val().trim();
        const phone = $('#regPhone').val().trim();
        const email = $('#regEmail').val().trim();
        const age = $('#regAge').val();
        const workType = $('#regWork').val();
        const price = $('#regPrice').val();
        const priceType = $('#regPriceType').val() || 'Per Day';
        const village = $('#regVillage').val();
        const pincode = $('#regPincode').val();
        const state = $('#regState').val();
        const district = $('#regDistrict').val();
        const id = $('#workerId').val(); // 0 for new, numeric for edit

        if (!name || !phone || !workType || !price || !village) {
            Swal.fire('अधूरा फॉर्म', 'कृपया सभी अनिवार्य (*) फील्ड भरें।', 'warning');
            return;
        }

        showCustomLoader('सेव हो रहा है...');

        let imageUrl = $('#currentImagePath').val();
        const photoFile = $('#regImage')[0].files[0];
        if (photoFile) {
            const uploadedUrl = await uploadWorkerPhoto(photoFile);
            if (uploadedUrl) imageUrl = uploadedUrl;
        }

        const workerData = {
            full_name: name,
            phone: phone,
            email: email,
            age: parseInt(age),
            work_type: workType,
            price: parseFloat(price),
            price_type: priceType,
            village_name: village,
            pincode: pincode,
            state_name: state,
            district_name: district,
            image_path: imageUrl,
            unique_hex_id: id == "0" ? '#' + Math.random().toString(16).slice(2, 8).toUpperCase() : undefined
        };

        let result;
        if (id == "0") {
            result = await supabase.from('workers').insert([workerData]);
        } else {
            result = await supabase.from('workers').update(workerData).eq('id', id);
        }

        Swal.close();
        if (result.error) {
            Swal.fire('त्रुटि', result.error.message, 'error');
        } else {
            speakHindi("आपका रजिस्ट्रेशन सफल हुआ।");
            Swal.fire('बधाई हो! 🎉', 'विवरण सुरक्षित हो गया।', 'success').then(() => {
                window.location.href = 'index.html';
            });
        }
    });

    // --- ADMIN SESSION PROTECTION ---
    window.checkAdminSession = async function () {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            localStorage.removeItem('isAdminLoggedIn');
            window.location.href = 'Login.html';
        } else {
            localStorage.setItem('isAdminLoggedIn', 'true');
            // Show body if it was hidden for protection
            $('body').show();
            if (window.location.pathname.includes('Login.html')) {
                window.location.href = 'Admin.html';
            }
        }
    };

    window.logoutAdmin = async function () {
        await supabase.auth.signOut();
        localStorage.removeItem('isAdminLoggedIn');
        window.location.href = 'Login.html';
    };

    // --- ADMIN DASHBOARD (SUPABASE) ---
    window.loadAdminWorkers = async function () {
        const { data, error, count } = await supabase.from('workers').select('*', { count: 'exact' });
        if (error) {
            console.error('Load admin workers error:', error);
            return;
        }

        $('#workerCount').text(`${count || 0} Registered Workers`);

        let html = '';
        if (data) {
            data.forEach(w => {
                const img = w.image_path || 'Image/default_profile.png';
                const rowStyle = !w.is_active ? 'style="background: rgba(239, 68, 68, 0.15);"' : '';
                html += `<tr ${rowStyle}>
                    <td><img src="${img}" style="width:50px; height:50px; border-radius:50%; object-fit:cover; border:1px solid var(--glass-border);"></td>
                    <td>
                        <div style="font-weight:700;">${w.full_name}</div>
                        <div style="font-size:0.75rem; color:var(--text-muted);">ID: ${w.unique_hex_id}</div>
                    </td>
                    <td>${w.work_type}</td>
                    <td>${w.village_name}, ${w.district_name}</td>
                    <td>
                        <div>${w.phone}</div>
                        <div style="font-size:0.8rem; color:var(--secondary);">${w.email || '-'}</div>
                    </td>
                    <td>₹ ${w.price} (${w.price_type === 'Per Day' ? 'प्रति दिन' : 'ठेका'})</td>
                    <td>
                        <div style="display:flex; gap:5px;">
                            <button class="btn-primary" style="padding:5px 10px; font-size:12px; height:auto;" onclick="editWorker(${w.id})">Edit</button>
                            <button class="btn-delete" style="padding:5px 10px; font-size:12px; height:auto;" onclick="deleteWorker(${w.id})">Del</button>
                            <button class="btn-primary" style="padding:5px 10px; font-size:12px; height:auto; background: ${w.is_active ? '#10b981' : '#6b7280'};" onclick="toggleVisibility(${w.id}, ${w.is_active})">${w.is_active ? 'Hide' : 'Show'}</button>
                        </div>
                    </td>
                </tr>`;
            });
        }
        $('#adminWorkersTable').html(html || '<tr><td colspan="7">No workers yet</td></tr>');
    };

    window.deleteWorker = async function (id) {
        const { isConfirmed } = await Swal.fire({
            title: 'Delete',
            text: "Do you really want to delete this user? This record will be deleted forever!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444'
        });

        if (isConfirmed) {
            const { error } = await supabase.from('workers').delete().eq('id', id);
            if (error) Swal.fire('Error', error.message, 'error');
            else loadAdminWorkers();
        }
    };

    window.toggleVisibility = async function (id, currentStatus) {
        const { error } = await supabase.from('workers').update({ is_active: !currentStatus }).eq('id', id);
        if (!error) loadAdminWorkers();
    };

    window.editWorker = function (id) {
        window.location.href = 'Edit_Workers.html?id=' + id;
    };

    // --- INITIALIZATION ---
    fetchAllWorkTypes(() => {
        if ($('#workersContainer').length) loadWorkers();
        if ($('#adminWorkersTable').length) loadAdminWorkers();

        // --- LOAD DATA FOR EDITING ---
        const urlParams = new URLSearchParams(window.location.search);
        const editId = urlParams.get('id');
        if (editId && (window.location.pathname.includes('Edit_Workers.html') || window.location.pathname.includes('Register.html'))) {
            loadWorkerForEdit(editId);
        }
    });

    async function loadWorkerForEdit(id) {
        const { data, error } = await supabase.from('workers').select('*').eq('id', id).single();
        if (!error && data) {
            $('#workerId').val(data.id);
            $('#regName').val(data.full_name);
            $('#regPhone').val(data.phone);
            $('#regEmail').val(data.email || '');
            $('#regAge').val(data.age);
            $('#regWork').val(data.work_type);
            $('#regPrice').val(data.price);
            $('#regPriceType').val(data.price_type);
            $('#regPincode').val(data.pincode);
            $('#regState').val(data.state_name);
            $('#regDistrict').val(data.district_name);
            $('#regVillage').val(data.village_name);
            $('#currentImagePath').val(data.image_path);

            if (data.image_path) {
                $('#imgPreview').attr('src', data.image_path).parent().fadeIn();
                $('#imagePreviewContainer').fadeIn();
            }

            // Load Village dropdown silently if data exists
            if (data.pincode) {
                silentlyLoadVillages(data.pincode, data.village_name);
            }

            // Select buttons in options grid
            $(`.btn-option[onclick*="'${data.work_type}'"]`).addClass('selected');
            $(`.btn-option[onclick*="'${data.price_type}'"]`).addClass('selected');
        }
    }

    // --- MULTI-STEP REGISTRATION LOGIC ---
    window.speakHindi = function (text, onEndCallback) {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();

            setTimeout(() => {
                var msg = new SpeechSynthesisUtterance();
                msg.text = text;
                msg.lang = 'hi-IN';
                msg.rate = 0.9;

                if (onEndCallback) {
                    msg.onend = onEndCallback;
                    // Fallback for some browsers where onend doesn't fire correctly
                    setTimeout(() => {
                        if (msg.speaking) return; // Still speaking
                        onEndCallback();
                    }, 10000);
                }

                window.speechSynthesis.speak(msg);
            }, 50);
        } else if (onEndCallback) {
            onEndCallback();
        }
    };

    window.goToStep = function (step) {
        $('.reg-step').removeClass('active').hide();
        var $activeStep = $('.reg-step[data-step="' + step + '"]');
        $activeStep.addClass('active').fadeIn();

        // Speak instruction
        var voiceText = $activeStep.attr('data-voice');
        if (voiceText) speakHindi(voiceText);
    };

    window.nextStep = function (current) {
        if (!validateStep(current)) return;

        let valueToSpeak = "";
        if (current === 1) valueToSpeak = "आपका नाम " + $('#regName').val() + " है।";
        if (current === 2) {
            const num = $('#regPhone').val();
            valueToSpeak = "आपका नंबर है, " + num.split('').join(', ') + "।";
        }
        if (current === 4) valueToSpeak = "आपकी उम्र " + $('#regAge').val() + " साल है।";

        if (valueToSpeak) {
            speakHindi(valueToSpeak);
        }

        goToStep(current + 1);
        if (current + 1 === 9) showFinalSummary();
    };

    window.previousStep = function (current) {
        goToStep(current - 1);
    };

    window.skipStep = function (current) {
        goToStep(current + 1);
        if (current + 1 === 9) showFinalSummary();
    };

    function validateStep(step) {
        if (step === 1) {
            const name = $('#regName').val().trim();
            if (!name) {
                const msg = "कृपया अपना नाम लिखें।";
                Swal.fire('Error', msg, 'error');
                speakHindi(msg);
                return false;
            }
            if (name.length < 3 || name.length > 20) {
                const msg = "नाम 3 से 20 अक्षरों के बीच होना चाहिए।";
                Swal.fire('Error', msg, 'error');
                speakHindi(msg);
                return false;
            }
            if (!/^[a-zA-Z\s\u0900-\u097F]+$/.test(name)) {
                const msg = "नाम में केवल अक्षर होने चाहिए।";
                Swal.fire('Error', msg, 'error');
                speakHindi(msg);
                return false;
            }
        }
        if (step === 2) {
            const phone = $('#regPhone').val().trim();
            if (!/^[6-9]\d{9}$/.test(phone)) {
                const msg = "कृपया 10 अंकों का सही मोबाइल नंबर लिखें।";
                Swal.fire('Error', msg, 'error');
                speakHindi(msg);
                return false;
            }
            // Check for repeated sequences like 1111111111
            if (/^(\d)\1{9}$/.test(phone)) {
                const msg = "यह मोबाइल नंबर मान्य नहीं है।";
                Swal.fire('Error', msg, 'error');
                speakHindi(msg);
                return false;
            }
        }
        if (step === 3) {
            const email = $('#regEmail').val().trim();
            if (email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
                const msg = "कृपया सही ईमेल पता लिखें।";
                Swal.fire('Error', msg, 'error');
                speakHindi(msg);
                return false;
            }
        }
        if (step === 4) {
            const age = parseInt($('#regAge').val());
            if (isNaN(age) || age < 18 || age > 70) {
                const msg = "वर्कर की उम्र 18 से 70 साल के बीच होनी चाहिए।";
                Swal.fire('Error', msg, 'error');
                speakHindi(msg);
                return false;
            }
        }
        if (step === 5 && !$('#regWork').val()) {
            const msg = "कृपया काम चुनें।";
            Swal.fire('Error', msg, 'error');
            speakHindi(msg);
            return false;
        }
        if (step === 6 && !$('#regPrice').val()) {
            const msg = "कृपया दिहाड़ी लिखें।";
            Swal.fire('Error', msg, 'error');
            speakHindi(msg);
            return false;
        }
        if (step === 7 && !$('#regVillage').val()) {
            const msg = "कृपया अपना गाँव चुनें।";
            Swal.fire('Error', msg, 'error');
            speakHindi(msg);
            return false;
        }
        return true;
    }

    window.selectWork = function (name, btn) {
        $('#regWork').val(name);
        $('#workTypeOptions .btn-option').removeClass('selected');
        $(btn).addClass('selected');
    };

    window.selectPriceType = function (type, btn) {
        $('#regPriceType').val(type);
        $(btn).closest('.options-grid').find('.btn-option').removeClass('selected');
        $(btn).addClass('selected');
    };

    function showFinalSummary() {
        const imgSrc = $('#imgPreview').attr('src') || 'Image/default_profile.png';
        const workType = $('#regWork').val() || '-';
        const priceType = $('#regPriceType').val() || 'Per Day';

        var html = `
            <div style="text-align:center; margin-bottom:1rem;">
                <img src="${imgSrc}" style="width:100px; height:100px; border-radius:50%; object-fit:cover; border:2px solid var(--secondary);">
            </div>
            <div class="summary-item"><strong>नाम:</strong> ${$('#regName').val()}</div>
            <div class="summary-item"><strong>फोन:</strong> ${$('#regPhone').val()}</div>
            <div class="summary-item"><strong>ईमेल:</strong> ${$('#regEmail').val() || 'N/A'}</div>
            <div class="summary-item"><strong>काम:</strong> ${workType}</div>
            <div class="summary-item"><strong>मजदूरी:</strong> ₹ ${$('#regPrice').val()} (${priceType})</div>
            <div class="summary-item"><strong>स्थान:</strong> ${$('#regVillage').val()}, ${$('#regDistrict').val()}</div>
        `;
        $('#finalSummary').html(html);
    }

    window.rateWorker = async function (id, rating) {
        // Logic for rating a worker
        const { data: worker } = await supabase.from('workers').select('rating, rating_count').eq('id', id).single();
        if (worker) {
            const newCount = (worker.rating_count || 0) + 1;
            const newRating = ((worker.rating || 0) * (worker.rating_count || 0) + rating) / newCount;

            await supabase.from('workers').update({
                rating: newRating,
                rating_count: newCount
            }).eq('id', id);

            Swal.fire('शुक्रिया!', 'आपकी रेटिंग सेव हो गई है।', 'success');
            loadWorkers();
        }
    };

    // --- REGISTRATION PINCODE VERIFICATION ---
    $('#btnVerifyPincode, #btnVerifyEditPincode').click(async function () {
        var pin = $('#regPincode').val();
        verifyPincodeLogic(pin);
    });

    async function verifyPincodeLogic(pin, selectedVillage = null) {
        if (!pin || pin.length !== 6) {
            Swal.fire('त्रुटि', '6 अंकों का पिनकोड डालें', 'error');
            return;
        }

        showCustomLoader('Verifying...');

        try {
            const res = await fetch('https://api.postalpincode.in/pincode/' + pin);
            const data = await res.json();
            Swal.close();

            if (data[0].Status === "Success") {
                const po = data[0].PostOffice;
                $('#displayState, #regState').text(po[0].State).val(po[0].State);
                $('#displayDistrict, #regDistrict').text(po[0].District).val(po[0].District);

                let vHtml = '<option value="">Select Village</option>';
                po.forEach(p => {
                    // For Register
                    const isSelected = selectedVillage === p.Name ? 'selected' : '';
                    vHtml += `<option value="${p.Name}" ${isSelected}>${p.Name}</option>`;
                });

                // Update Selects (for Edit Page)
                if ($('#regVillage').is('select')) {
                    $('#regVillage').html(vHtml);
                } else {
                    // Update grid (for Register Page)
                    let gridHtml = '';
                    po.forEach(p => {
                        gridHtml += `<button type="button" class="btn-option" style="padding: 10px; font-size: 0.9rem;" onclick="selectVillage('${p.Name}', this)">${p.Name}</button>`;
                    });
                    $('#villageList').html(gridHtml);
                }

                $('#locationDisplay').fadeIn();
                $('#btnLocationNext').fadeIn();
                speakHindi("अपना गाँव या शहर चुनें");
            } else {
                Swal.fire('Error', 'गलत पिनकोड', 'error');
            }
        } catch (err) {
            Swal.close();
            Swal.fire('Error', 'API Connection Failed', 'error');
        }
    }

    window.selectVillage = function (name, btn) {
        $('#regVillage').val(name);
        $('#villageList .btn-option').removeClass('selected');
        $(btn).addClass('selected');
    };

    // --- WORK TYPE MANAGEMENT (SUPABASE) ---
    window.loadWorkTypes = async function () {
        const { data, error } = await supabase.from('work_types').select('*').order('work_type_name');
        if (error) {
            console.error('Error loading work types:', error);
            return;
        }

        let html = '';
        data.forEach(item => {
            html += `<tr>
                    <td>${item.id}</td>
                    <td>${item.work_type_name}</td>
                    <td>${item.work_type_hindi}</td>
                    <td>
                        <button class="btn-primary" style="padding:5px 10px; font-size:12px; height:auto;" onclick="editWorkType(${item.id}, '${item.work_type_name}', '${item.work_type_hindi}')">Edit</button>
                        <button class="btn-delete" style="padding:5px 10px; font-size:12px; height:auto;" onclick="deleteWorkType(${item.id})">Delete</button>
                    </td>
                </tr>`;
        });
        $('#workTypeTableBody').html(html);
    };

    window.openWorkTypeModal = function () {
        $('#workTypeId').val('0');
        $('#workTypeName').val('');
        $('#workTypeHindi').val('');
        $('#modalTitle').text('Add Work Type');
        $('#workTypeModal').css('display', 'flex').hide().fadeIn();
    };

    window.closeWorkTypeModal = function () {
        $('#workTypeModal').fadeOut();
    };

    window.editWorkType = function (id, name, hindi) {
        $('#workTypeId').val(id);
        $('#workTypeName').val(name);
        $('#workTypeHindi').val(hindi);
        $('#modalTitle').text('Edit Work Type');
        $('#workTypeModal').css('display', 'flex').hide().fadeIn();
    };

    window.saveWorkType = async function () {
        const id = $('#workTypeId').val();
        const name = $('#workTypeName').val().trim();
        const hindi = $('#workTypeHindi').val().trim();

        if (!name || !hindi) {
            Swal.fire('Error', 'Please fill both names!', 'error');
            return;
        }

        const workTypeData = {
            work_type_name: name,
            work_type_hindi: hindi
        };

        let result;
        if (id == "0") {
            result = await supabase.from('work_types').insert([workTypeData]);
        } else {
            result = await supabase.from('work_types').update(workTypeData).eq('id', id);
        }

        if (result.error) {
            Swal.fire('Error', result.error.message, 'error');
        } else {
            Swal.fire('Success', 'Work type saved!', 'success');
            closeWorkTypeModal();
            loadWorkTypes();
        }
    };

    window.deleteWorkType = async function (id) {
        const { isConfirmed } = await Swal.fire({
            title: 'Are you sure?',
            text: "This might affect workers assigned to this type!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, delete it!'
        });

        if (isConfirmed) {
            const { error } = await supabase.from('work_types').delete().eq('id', id);
            if (error) {
                Swal.fire('Error', error.message, 'error');
            } else {
                Swal.fire('Deleted!', 'Work type removed.', 'success');
                loadWorkTypes();
            }
        }
    };

    // --- SEARCH & PAGINATION LISTENERS ---
    $('#searchInput').on('input', function () {
        currentPage = 1;
        loadWorkers(false);
    });

    $('#btnPrevPage').click(function () {
        if (currentPage > 1) {
            currentPage--;
            loadWorkers(true);
        }
    });

    $('#btnNextPage').click(function () {
        currentPage++;
        loadWorkers(true);
    });

    // --- INITIALIZATION ---
    fetchAllWorkTypes(function () {
        if ($('#workersContainer').length > 0) {
            window.loadWorkers();
        }
        if ($('#adminWorkersTable').length > 0) {
            window.loadAdminWorkers();
        }
    });

    // Start registration voice if on Register page
    if ($('.reg-step.active').length > 0) {
        var firstVoice = $('.reg-step.active').attr('data-voice');
        if (firstVoice) setTimeout(() => speakHindi(firstVoice), 100);
    }

    // --- UI HELPERS ---
    window.switchTab = function (tabId, btn) {
        $('.tab-content').hide();
        $('.tab-btn').removeClass('active');
        $('#' + tabId).show();
        $(btn).addClass('active');

        if (tabId === 'workTypeTab') {
            loadWorkTypes();
        }
    };

    // Set current year in footer
    $('#currentYear').text(new Date().getFullYear());

    // --- NAV LOGIC ---
    async function updateNavbar() {
        // First check actual Supabase session
        const { data: { session } } = await supabase.auth.getSession();
        const loggedIn = session ? true : false;

        // Synchronize with localStorage for backward compatibility
        if (loggedIn) localStorage.setItem('isAdminLoggedIn', 'true');
        else localStorage.removeItem('isAdminLoggedIn');

        // Toggle logout visibility
        $('.nav-links a:contains("Logout")').each(function () {
            if (loggedIn) $(this).show();
            else $(this).hide();
        });
    }
    updateNavbar();

    window.toggleFilterMenu = function (e) {
        if (e) e.stopPropagation();
        toggleCustomDropdown('customFilterDropdown');
    };

    window.toggleCustomDropdown = function (id) {
        // Close other dropdowns first
        $('.custom-filter-dropdown').not('#' + id).fadeOut(200);
        $('.custom-dropdown-wrapper').not($('#' + id).parent()).removeClass('dropdown-active');

        var $dropdown = $('#' + id);
        var $wrapper = $dropdown.parent();

        if ($dropdown.is(':visible')) {
            $dropdown.fadeOut(200);
            $wrapper.removeClass('dropdown-active');
        } else {
            $dropdown.fadeIn(200);
            $wrapper.addClass('dropdown-active');
        }
    };

    window.setCustomFilter = function (type, val, text) {
        if (type === 'state') {
            $('#stateFilter').val(val).trigger('change');
            $('#selectedStateText').text(text).css('color', 'var(--text-white)');
        } else if (type === 'dist') {
            $('#districtFilter').val(val).trigger('change');
            $('#selectedDistrictText').text(text).css('color', 'var(--text-white)');
        } else if (type === 'vill') {
            $('#villageFilter').val(val).trigger('change');
            $('#selectedVillageText').text(text).css('color', 'var(--text-white)');
        } else if (type === 'priceType') {
            $('#priceTypeFilter').val(val).trigger('change');
            $('#selectedPriceTypeText').text(text).css('color', 'var(--text-white)');
        }
        $('.custom-filter-dropdown').fadeOut(200);
        $('.custom-dropdown-wrapper').removeClass('dropdown-active');
    };

    $(document).click(function (e) {
        if (!$(e.target).closest('.custom-dropdown-wrapper').length) {
            $('.custom-filter-dropdown').fadeOut(200);
            $('.custom-dropdown-wrapper').removeClass('dropdown-active');
        }
    });

    async function silentlyLoadVillages(pin, selectedVillage = null) {
        try {
            const res = await fetch('https://api.postalpincode.in/pincode/' + pin);
            const data = await res.json();
            if (data[0].Status === "Success") {
                const po = data[0].PostOffice;
                let vHtml = '<option value="">Select Village</option>';
                po.forEach(p => {
                    const isSelected = selectedVillage === p.Name ? 'selected' : '';
                    vHtml += `<option value="${p.Name}" ${isSelected}>${p.Name}</option>`;
                });
                $('#regVillage').html(vHtml);
            }
        } catch (err) { console.error(err); }
    }

    // --- THEME TOGGLE LOGIC ---
    window.toggleTheme = function () {
        const body = $('body');
        const isLight = body.hasClass('light-mode');

        if (isLight) {
            body.removeClass('light-mode');
            localStorage.setItem('theme', 'dark');
            $('.theme-toggle i').removeClass('fa-sun').addClass('fa-moon');
            $('#theme-icon').html('<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>'); // Moon
        } else {
            body.addClass('light-mode');
            localStorage.setItem('theme', 'light');
            $('.theme-toggle i').removeClass('fa-moon').addClass('fa-sun');
            $('#theme-icon').html('<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>'); // Sun
        }
    };

    // Initialize Theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        $('body').addClass('light-mode');
        $('#theme-icon').html('<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>'); // Sun
    }

    // --- INITIAL LOAD ---
    fetchAllWorkTypes(() => {
        loadWorkers(false);
    });

    if (typeof loadRegisteredStates === 'function') loadRegisteredStates();
});

// --- PREVIEW IMAGE LOGIC ---
window.previewImage = function (input) {
    if (input.files && input.files[0]) {
        var file = input.files[0];
        if (!/(\.jpg|\.jpeg|\.png)$/i.exec(file.name)) {
            Swal.fire('Error', 'Invalid file type', 'error');
            return;
        }
        var reader = new FileReader();
        reader.onload = e => {
            $('#imgPreview').attr('src', e.target.result).parent().fadeIn();
            $('#imagePreviewContainer').fadeIn();
            $('#btnRemovePhoto').show();
            $('#photoBtnText').text('Change Photo');
        };
        reader.readAsDataURL(file);
    }
}

window.removeRegisterPhoto = function () {
    $('#regImage').val('');
    $('#imgPreview').attr('src', '');
    $('#imagePreviewContainer').hide();
    $('#photoBtnText').text('Select Photo');
}
