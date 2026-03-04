// --- SHARED UTILITIES & FUNCTIONS ---
var allWorkTypes = [];
var currentPage = 1;
var pageSize = 15;

// --- CUSTOM LIQUID LOADER FOR SWEETALERT2 ---
function showCustomLoader(titleText) {
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
}

// --- FETCH WORK TYPES FROM SUPABASE ---
async function fetchAllWorkTypes(callback) {
    const { data, error } = await supabase.from('work_types').select('*');
    if (error) {
        console.error('Work types fetch error:', error);
        return;
    }

    allWorkTypes = $.map(data, function (item) {
        return {
            WorkTypeID: item.id,
            WorkTypeName: item.work_type_name,
            WorkTypeHindi: item.work_type_hindi
        };
    });

    if ($('#regWork').length) {
        const currentVal = $('#regWork').val();
        let opts = '<option value="">Select Work</option>';
        $.each(allWorkTypes, function (i, item) {
            opts += `<option value="${item.WorkTypeName}">${item.WorkTypeName} (${item.WorkTypeHindi})</option>`;
        });
        $('#regWork').html(opts);
        if (currentVal) $('#regWork').val(currentVal);
    }

    if ($('#workTypeOptions').length > 0) {
        var html = '';
        $.each(allWorkTypes, function (i, item) {
            html += `<button type="button" class="btn-option" onclick="selectWork('${item.WorkTypeName}', this)">${item.WorkTypeHindi}</button>`;
        });
        $('#workTypeOptions').html(html);
    }

    if (callback) callback();
}

// --- HOMEPAGE FILTER LOGIC ---
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

// --- WORKER LOADING LOGIC (SUPABASE) ---
async function loadWorkers(shouldScroll) {
    const searchTerm = $('#searchInput').val()?.trim() || "";
    const state = $('#stateFilter').val();
    const dist = $('#districtFilter').val();
    const vill = $('#villageFilter').val();
    const pin = $('#pincodeFilter').val();
    const priceT = $('#priceTypeFilter').val();

    if (searchTerm.length === 0) {
        $('#workersContainer').html('<div style="grid-column: 1/-1; display: flex; justify-content: center; padding: 3rem;"><div class="liquid-loader"><div class="loading-text">Loading...</div><div class="loader-track"><div class="liquid-fill"></div></div></div></div>');
    }

    let query = supabase.from('workers').select('*', { count: 'exact' }).eq('is_active', true);

    if (searchTerm) query = query.ilike('full_name', `%${searchTerm}%`);
    if (state) query = query.eq('state_name', state);
    if (dist) query = query.eq('district_name', dist);
    if (vill) query = query.eq('village_name', vill);
    if (pin) query = query.eq('pincode', pin);
    if (priceT) query = query.eq('price_type', priceT);

    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to).order('rating', { ascending: false }).order('created_at', { ascending: false });

    const { data, count, error } = await query;

    if (error) {
        console.error('Load workers error:', error);
        $('#workersContainer').html('<div style="grid-column: 1/-1; text-align: center; color: red;">डेटा लोड नहीं हो पाया।</div>');
        return;
    }

    $('#btnPrevPage').toggle(currentPage > 1);
    $('#btnNextPage').toggle(count > (currentPage * pageSize));

    let html = '';
    if (!data || data.length === 0) {
        html = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem;">कोई वर्कर नहीं मिला।</div>';
    } else {
        $.each(data, function (i, w) {
            const imgSrc = w.image_path || 'Image/default_profile.png';
            const pTypeHindi = w.price_type == 'Per Day' ? 'प्रति दिन' : 'ठेका';
            const matchedType = $.grep(allWorkTypes, function (t) { return t.WorkTypeName === w.work_type; })[0];
            const wTypeDisplay = matchedType ? `${matchedType.WorkTypeHindi} (${matchedType.WorkTypeName})` : w.work_type;

            let stars = '';
            const rating = Math.round(w.rating || 0);
            $.each([1, 2, 3, 4, 5], function (idx, s) {
                stars += `<span class="star ${s <= rating ? 'filled' : ''}" onclick="rateWorker(${w.id}, ${s})">${s <= rating ? '★' : '☆'}</span>`;
            });

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

    if (shouldScroll && data.length > 0) {
        $('html, body').animate({ scrollTop: $("#workersContainer").offset().top - 100 }, 800);
    }
}

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
                const MAX_SIZE = 800;
                if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } }
                else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => { resolve(new File([blob], file.name, { type: 'image/jpeg' })); }, 'image/jpeg', 0.7);
            };
        };
    });
}

// --- PHOTO UPLOAD ---
async function uploadWorkerPhoto(file) {
    if (!file) return null;
    try {
        const compressedFile = await compressImage(file);
        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.jpg`;
        const { data, error } = await supabase.storage.from('WorkersImage').upload('photos/' + fileName, compressedFile);
        if (error) return null;
        const { data: publicUrlData } = supabase.storage.from('WorkersImage').getPublicUrl('photos/' + fileName);
        return publicUrlData.publicUrl;
    } catch (e) { return null; }
}

// --- PHOTO PREVIEW & REMOVE ---
function previewImage(input) {
    if (input.files && input.files[0]) {
        var reader = new FileReader();
        reader.onload = function (e) {
            $('#imgPreview').attr('src', e.target.result);
            $('#imagePreviewContainer').fadeIn();
            $('#photoBtnText').text('Change Photo');
        }
        reader.readAsDataURL(input.files[0]);
    }
}

function removeRegisterPhoto() {
    $('#regImage').val('');
    $('#imgPreview').attr('src', '');
    $('#imagePreviewContainer').fadeOut();
    $('#photoBtnText').text('फोटो चुनें (Select Photo)');
}

// --- SPEECH & REGISTRATION HELPERS ---
function speakHindi(text, onEndCallback) {
    if (window.disableVoice) return;
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        var msg = new SpeechSynthesisUtterance(text);
        msg.lang = 'hi-IN'; msg.rate = 0.9;
        if (onEndCallback) msg.onend = onEndCallback;
        window.speechSynthesis.speak(msg);
    } else if (onEndCallback) onEndCallback();
}

function goToStep(step, skipVoice = false) {
    $('.reg-step').removeClass('active').hide();
    var $activeStep = $(`.reg-step[data-step="${step}"]`);
    $activeStep.addClass('active').fadeIn();
    var voiceText = $activeStep.attr('data-voice');
    if (!skipVoice && voiceText) speakHindi(voiceText);
}

function nextStep(current) {
    if (!validateStep(current)) return;

    let confirmationText = "";
    if (current === 1) confirmationText = "आपका नाम " + $('#regName').val() + " है। ";
    if (current === 2) {
        confirmationText = "आपका मोबाइल नंबर " + $('#regPhone').val().split('').join(', ') + " है। ";
    }
    if (current === 3) {
        const email = $('#regEmail').val().trim();
        confirmationText = email ? "आपका ईमेल " + email + " है। " : "ईमेल छोड़ दिया गया है। ";
    }
    if (current === 4) confirmationText = "आपकी उम्र " + $('#regAge').val() + " साल है। ";
    if (current === 5) {
        const work = $('#regWork').val();
        const matched = $.grep(allWorkTypes, function (t) { return t.WorkTypeName === work; })[0];
        confirmationText = "आपका काम " + (matched ? matched.WorkTypeHindi : work) + " है। ";
    }
    if (current === 6) {
        const price = $('#regPrice').val();
        const type = $('#regPriceType').val() === 'Per Day' ? 'प्रति दिन' : 'ठेका';
        confirmationText = "आपकी मजदूरी " + price + " रुपए " + type + " है। ";
    }
    if (current === 7) {
        confirmationText = "आपका गाँव " + $('#regVillage').val() + " है और पिनकोड " + $('#regPincode').val() + " है। ";
    }
    if (current === 8) {
        const hasPhoto = $('#regImage')[0].files.length > 0 || $('#currentImagePath').val();
        confirmationText = hasPhoto ? "फोटो चुन ली गई है। " : "फोटो नहीं लगाई गई है। ";
    }

    var $next = $(`.reg-step[data-step="${current + 1}"]`);
    var nextVoice = $next.attr('data-voice') || "";

    // Combine Confirmation + Next Prompt to avoid cancellation
    speakHindi(confirmationText + nextVoice);

    goToStep(current + 1, true); // Move UI but skip voice as we combined it
    if (current + 1 === 9) showFinalSummary();
}

function previousStep(current) {
    goToStep(current - 1);
}

function skipStep(current) {
    let confirmationText = "";
    if (current === 3) confirmationText = "ईमेल छोड़ दिया गया है। ";
    if (current === 8) confirmationText = "फोटो नहीं लगाई गई है। ";

    var $next = $(`.reg-step[data-step="${current + 1}"]`);
    var nextVoice = $next.attr('data-voice') || "";

    speakHindi(confirmationText + nextVoice);

    goToStep(current + 1, true);
    if (current + 1 === 9) showFinalSummary();
}

function validateStep(step) {
    let errorMsg = "";
    if (step === 1) {
        const name = $('#regName').val().trim();
        if (!name) errorMsg = "कृपया अपना नाम लिखें।";
        else if (name.length < 3) errorMsg = "नाम कम से कम 3 अक्षरों का होना चाहिए।";
        else if (name.length > 30) errorMsg = "नाम 30 अक्षरों से ज्यादा नहीं हो सकता।";
        else if (/[0-9]/.test(name)) errorMsg = "नाम में नंबर नहीं हो सकते।";
        else if (/[!@#$%^&*(),.?":{}|<>]/g.test(name)) errorMsg = "नाम में खास अक्षर (!@#) नहीं हो सकते।";
    }
    if (step === 2) {
        const phone = $('#regPhone').val().trim();
        if (!phone) errorMsg = "मोबाइल नंबर लिखना अनिवार्य है।";
        else if (phone.length !== 10) errorMsg = "मोबाइल नंबर पूरे 10 अंकों का होना चाहिए।";
        else if (!/^[6-9]\d{9}$/.test(phone)) errorMsg = "कृपया 10 अंकों का सही मोबाइल नंबर लिखें जो 6, 7, 8 या 9 से शुरू हो।";
        else if (/^(.)\1{9}$/.test(phone)) errorMsg = "यह मोबाइल नंबर अमान्य लग रहा है, कृपया सही नंबर डालें।";
    }
    if (step === 3) {
        const email = $('#regEmail').val().trim();
        const emailRegex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        if (email && !emailRegex.test(email)) errorMsg = "कृपया सही ईमेल पता लिखें (जैसे: example@mail.com) या इसे छोड़ दें।";
    }
    if (step === 4) {
        const age = parseInt($('#regAge').val());
        if (isNaN(age)) errorMsg = "अपनी उम्र लिखें।";
        else if (age < 18 || age > 75) errorMsg = "आपकी उम्र 18 से 75 साल के बीच होनी चाहिए।";
    }
    if (step === 5 && !$('#regWork').val()) {
        errorMsg = "कृपया अपने काम का प्रकार चुनें।";
    }
    if (step === 6) {
        const price = $('#regPrice').val();
        if (!price || price <= 0) errorMsg = "अपनी मजदूरी की सही कीमत लिखें।";
        else if (price > 100000) errorMsg = "यह मजदूरी बहुत ज्यादा लग रही है, कृपया सही विवरण दें।";
    }
    if (step === 7) {
        if ($('#regPincode').val().length !== 6) errorMsg = "6 अंकों का पिनकोड डालें।";
        else if (!$('#regVillage').val()) errorMsg = "पिनकोड Verify करके अपना गाँव चुनें।";
    }

    if (errorMsg) {
        speakHindi(errorMsg);
        Swal.fire({
            icon: 'error',
            title: 'गलती (Validation Error)',
            text: errorMsg,
            confirmButtonColor: '#ec4899'
        });
        return false;
    }
    return true;
}

function selectWork(name, btn) {
    $('#regWork').val(name);
    $('#workTypeOptions .btn-option').removeClass('selected');
    $(btn).addClass('selected');
    const matched = $.grep(allWorkTypes, function (t) { return t.WorkTypeName === name; })[0];
    speakHindi("आपने " + (matched ? matched.WorkTypeHindi : name) + " चुना है।");
}

function selectPriceType(type, btn) {
    $('#regPriceType').val(type);
    $(btn).closest('.options-grid').find('.btn-option').removeClass('selected');
    $(btn).addClass('selected');
    speakHindi(type === 'Per Day' ? "प्रति दिन चुना गया।" : "ठेका चुना गया।");
}

function selectVillage(name, btn) {
    $('#regVillage').val(name);
    $('#villageList .btn-option').removeClass('selected');
    $(btn).addClass('selected');
    speakHindi("आपने " + name + " चुना है।");
}

function showFinalSummary() {
    const name = $('#regName').val();
    const phone = $('#regPhone').val();
    const age = $('#regAge').val();
    const email = $('#regEmail').val().trim();
    const work = $('#regWork').val();
    const matched = $.grep(allWorkTypes, function (t) { return t.WorkTypeName === work; })[0];
    const workText = matched ? matched.WorkTypeHindi : work;
    const price = $('#regPrice').val();
    const pType = $('#regPriceType').val() === 'Per Day' ? 'प्रति दिन' : 'ठेका';
    const location = `${$('#regVillage').val()}, ${$('#regDistrict').val()}`;
    const img = $('#imgPreview').attr('src') || 'Image/default_profile.png';

    var html = `
        <div class="summary-premium-card glass animate-fade">
            <div class="summary-photo-section">
                <img src="${img}" class="summary-avatar" alt="Profile">
                <button type="button" class="btn-change-photo" onclick="goToStep(8)">
                    <i class="fas fa-camera"></i> फोटो बदलें
                </button>
            </div>
            <div class="summary-details">
                <div class="summary-item">
                    <span class="label">नाम (Name)</span>
                    <span class="value">${name}</span>
                </div>
                <div class="summary-item">
                    <span class="label">उम्र (Age)</span>
                    <span class="value">${age} साल</span>
                </div>
                <div class="summary-item">
                    <span class="label">फोन (Contact)</span>
                    <span class="value">${phone}</span>
                </div>
                ${email ? `
                <div class="summary-item">
                    <span class="label">ईमेल (Email)</span>
                    <span class="value">${email}</span>
                </div>` : ''}
                <div class="summary-item">
                    <span class="label">काम (Skill)</span>
                    <span class="value">${workText}</span>
                </div>
                <div class="summary-item">
                    <span class="label">मजदूरी (Price)</span>
                    <span class="value">₹ ${price} (${pType})</span>
                </div>
                <div class="summary-item">
                    <span class="label">जगह (Location)</span>
                    <span class="value">${location}</span>
                </div>
            </div>
        </div>
    `;
    $('#finalSummary').html(html);
}

async function verifyPincodeLogic(pin, selectedVillage = null) {
    if (!pin || pin.length !== 6) return;
    showCustomLoader('खोज रहे है...');
    try {
        const res = await fetch('https://api.postalpincode.in/pincode/' + pin);
        const data = await res.json(); Swal.close();
        if (data[0].Status === "Success") {
            const po = data[0].PostOffice;
            const state = po[0].State;
            const district = po[0].District;

            // Registration Fields
            $('#regState').val(state);
            $('#regDistrict').val(district);
            $('#displayState').text(state);
            $('#displayDistrict').text(district);

            // Homepage Filter Fields
            if ($('#stateFilter').length) {
                $('#stateFilter').html(`<option value="${state}">${state}</option>`).val(state);
                $('#selectedStateText').text(state).css('color', 'var(--text-white)');
                $('#stateOptions').html(`<div class="filter-option" onclick="setCustomFilter('state', '', 'सभी राज्य')">सभी राज्य</div><div class="filter-option" onclick="setCustomFilter('state', '${state}', '${state}')">${state}</div>`);

                $('#districtFilter').html(`<option value="${district}">${district}</option>`).val(district);
                $('#selectedDistrictText').text(district).css('color', 'var(--text-white)');
                $('#districtOptions').html(`<div class="filter-option" onclick="setCustomFilter('dist', '', 'सभी जिले')">सभी जिले</div><div class="filter-option" onclick="setCustomFilter('dist', '${district}', '${district}')">${district}</div>`);
            }

            let opts = '<option value="">Select Village</option>';
            let regGrid = '';
            let homeGrid = `<div class="filter-option" onclick="setCustomFilter('vill', '', 'सभी गाँव/शहर')">सभी गाँव/शहर</div>`;

            $.each(po, function (i, p) {
                opts += `<option value="${p.Name}" ${selectedVillage === p.Name ? 'selected' : ''}>${p.Name}</option>`;
                regGrid += `<button type="button" class="btn-option" onclick="selectVillage('${p.Name}', this)">${p.Name}</button>`;
                homeGrid += `<div class="filter-option" onclick="setCustomFilter('vill', '${p.Name}', '${p.Name}')">${p.Name}</div>`;
            });

            if ($('#regVillage').is('select')) {
                $('#regVillage').html(opts);
            } else if ($('#villageList').length) {
                $('#villageList').html(regGrid);
            }

            if ($('#villageOptions').length) {
                $('#villageOptions').html(homeGrid);
                $('#villageFilter').html(opts);
            }

            $('#locationDisplay').fadeIn();
            $('#btnLocationNext').fadeIn();
            speakHindi("गाँव चुनें");

            if ($('#workersContainer').length) {
                currentPage = 1;
                loadWorkers(false);
            }
        } else {
            Swal.fire('Error', 'पिनकोड गलत है या सेवा उपलब्ध नहीं है।', 'error');
        }
    } catch (e) { Swal.close(); }
}

function goToAdmin() {
    if (localStorage.getItem('isAdminLoggedIn') === 'true') {
        window.location.href = 'Admin.html';
    } else {
        window.location.href = 'Login.html';
    }
}

async function rateWorker(id, rating) {
    const { data: worker } = await supabase.from('workers').select('rating, rating_count').eq('id', id).single();
    if (worker) {
        const newCount = (worker.rating_count || 0) + 1;
        const newRating = ((worker.rating || 0) * (worker.rating_count || 0) + rating) / newCount;
        await supabase.from('workers').update({ rating: newRating, rating_count: newCount }).eq('id', id);
        Swal.fire('शुक्रिया!', 'रेटिंग सेव हो गई।', 'success'); loadWorkers();
    }
}

async function silentlyLoadVillages(pin, selectedVillage = null) {
    try {
        const res = await fetch('https://api.postalpincode.in/pincode/' + pin);
        const data = await res.json();
        if (data[0].Status === "Success") {
            let opts = '<option value="">Select Village</option>';
            $.each(data[0].PostOffice, function (i, p) {
                opts += `<option value="${p.Name}" ${selectedVillage === p.Name ? 'selected' : ''}>${p.Name}</option>`;
            });
            $('#regVillage').html(opts);
        }
        else {
            Swal.fire('Error', 'Pincode not found', 'error');
        }
    } catch (e) { }
}

// --- FILTER HANDLING (HOMEPAGE) ---
function toggleFilterMenu(e) {
    e.stopPropagation();
    $('#customFilterDropdown').fadeToggle(200);
}

function toggleCustomDropdown(id) {
    const wasOpen = $('#' + id).is(':visible');
    $('.custom-filter-dropdown').fadeOut(200);
    $('.custom-dropdown-wrapper').removeClass('dropdown-active');

    if (!wasOpen) {
        $('#' + id).fadeIn(200);
        $('#' + id).closest('.custom-dropdown-wrapper').addClass('dropdown-active');
    }
}

function setCustomFilter(type, value, text) {
    if (type === 'priceType') {
        $('#priceTypeFilter').val(value);
        $('#selectedPriceTypeText').text(text).css('color', 'var(--text-white)');
        $('#customFilterDropdown').fadeOut(200);
    } else if (type === 'state') {
        $('#stateFilter').val(value);
        $('#selectedStateText').text(text).css('color', value ? 'var(--text-white)' : 'var(--text-muted)');
    } else if (type === 'dist') {
        $('#districtFilter').val(value);
        $('#selectedDistrictText').text(text).css('color', value ? 'var(--text-white)' : 'var(--text-muted)');
    } else if (type === 'vill') {
        $('#villageFilter').val(value);
        $('#selectedVillageText').text(text).css('color', value ? 'var(--text-white)' : 'var(--text-muted)');
    }

    $('.custom-filter-dropdown').fadeOut(200);
    $('.custom-dropdown-wrapper').removeClass('dropdown-active');
    currentPage = 1;
    loadWorkers(false);
}

function toggleTheme() {
    const body = $('body'); const isLight = body.hasClass('light-mode');
    if (isLight) {
        body.removeClass('light-mode'); localStorage.setItem('theme', 'dark');
        $('#theme-icon').html('<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>');
    } else {
        body.addClass('light-mode'); localStorage.setItem('theme', 'light');
        $('#theme-icon').html('<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>');
    }
}

async function loadNavbar() {
    if (window.location.protocol === 'file:') return;
    try {
        const res = await fetch('Components/navbar.html');
        const html = await res.text();
        $("#navbar-placeholder").html(html);
        const cur = window.location.pathname.split("/").pop() || 'index.html';
        $(".nav-item").each(function () { if ($(this).attr("href") === cur) $(this).addClass("active").css("color", "var(--secondary)"); });

        // Ensure logout button visibility
        if (localStorage.getItem('isAdminLoggedIn') === 'true') {
            $('#logoutBtn').show();
        }
    } catch (e) { }
}

async function logoutAdmin() {
    await supabase.auth.signOut();
    localStorage.removeItem('isAdminLoggedIn');
    window.location.href = 'Login.html';
}

async function initApp() {
    await fetchAllWorkTypes();
    const id = new URLSearchParams(window.location.search).get('id');
    if (id && typeof loadWorkerForEdit === 'function') await loadWorkerForEdit(id);
    if ($('#workersContainer').length) loadWorkers(false);
    if ($('#adminWorkersTable').length && typeof loadAdminWorkers === 'function') loadAdminWorkers();
    if ($('#workTypeTableBody').length && typeof loadWorkTypes === 'function') loadWorkTypes();
    loadNavbar();

    // Theme recovery
    if (localStorage.getItem('theme') === 'light') {
        $('body').addClass('light-mode');
        $('#theme-icon').html('<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>');
    }

    if (typeof checkAdminSession === 'function' && (window.location.pathname.includes('Admin') || window.location.pathname.includes('Edit'))) checkAdminSession();

    // Trigger voice on registration page start
    if (window.location.pathname.includes('Register.html')) {
        window.disableVoice = false;
        setTimeout(() => { goToStep(1); }, 300);
    } else if (window.location.pathname.includes('Edit_Workers.html')) {
        window.disableVoice = true;
    }
}

// --- DOM READY ---
$(document).ready(function () {
    initApp();

    $('#search-icon').click(() => loadWorkers(true));
    $('#searchInput').on('input', function () { currentPage = 1; loadWorkers(false); });
    $('#btnPrevPage').click(function () { if (currentPage > 1) { currentPage--; loadWorkers(true); } });
    $('#btnNextPage').click(function () { currentPage++; loadWorkers(true); });

    $('#btnRegister').click(async function () {
        const name = $('#regName').val();
        if (!name || !$('#regPhone').val() || !$('#regWork').val()) { Swal.fire('Error', 'फॉर्म भरें।', 'warning'); return; }
        showCustomLoader('सेव हो रहा है...');
        let photo = $('#currentImagePath').val();
        const file = $('#regImage')[0].files[0];
        if (file) { const url = await uploadWorkerPhoto(file); if (url) photo = url; }
        const workerData = {
            full_name: name, phone: $('#regPhone').val(), email: $('#regEmail').val(),
            age: parseInt($('#regAge').val()), work_type: $('#regWork').val(),
            price: parseFloat($('#regPrice').val()), price_type: $('#regPriceType').val() || 'Per Day',
            village_name: $('#regVillage').val(), pincode: $('#regPincode').val(),
            state_name: $('#regState').val(), district_name: $('#regDistrict').val(),
            image_path: photo,
            unique_hex_id: $('#workerId').val() == "0" ? '#' + Math.random().toString(16).slice(2, 8).toUpperCase() : undefined
        };
        let res;
        if ($('#workerId').val() == "0") res = await supabase.from('workers').insert([workerData]);
        else res = await supabase.from('workers').update(workerData).eq('id', $('#workerId').val());
        Swal.close();
        if (res.error) Swal.fire('Error', res.error.message, 'error');
        else { speakHindi("सफल हुआ।"); Swal.fire('सफल!', 'सुरक्षित हो गया।', 'success').then(() => window.location.href = 'index.html'); }
    });

    $('#btnVerifyHomePincode').click(() => verifyPincodeLogic($('#pincodeFilter').val()));
    $('#btnVerifyPincode, #btnVerifyEditPincode').click(() => verifyPincodeLogic($('#regPincode').val()));

    $(document).click(function (e) {
        if (!$(e.target).closest('.custom-dropdown-wrapper').length && !$(e.target).closest('#customFilterDropdown').length) {
            $('.custom-filter-dropdown').fadeOut(200);
            $('.custom-dropdown-wrapper').removeClass('dropdown-active');
        }
    });
});

