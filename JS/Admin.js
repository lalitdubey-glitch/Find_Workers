$(document).ready(function () {
    if (typeof checkAdminSession === 'function') checkAdminSession();
});

// --- ADMIN SESSION PROTECTION ---
async function checkAdminSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        localStorage.removeItem('isAdminLoggedIn');
        window.location.href = 'Login.html';
    } else {
        localStorage.setItem('isAdminLoggedIn', 'true');
        $('#logoutBtn').show();
        if (window.location.pathname.includes('Login.html')) {
            window.location.href = 'Admin.html';
        }
    }
}

async function logoutAdmin() {
    await supabase.auth.signOut();
    localStorage.removeItem('isAdminLoggedIn');
    window.location.href = 'Login.html';
}

// --- ADMIN DASHBOARD PAGINATION ---
let adminCurrentPage = 1;
const adminPageSize = 10;

// --- ADMIN DASHBOARD ---
async function loadAdminWorkers() {
    const from = (adminCurrentPage - 1) * adminPageSize;
    const to = from + adminPageSize - 1;

    const { data, error, count } = await supabase
        .from('workers')
        .select('*', { count: 'exact' })
        .range(from, to)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Load admin workers error:', error);
        return;
    }

    if ($('#workerCount').length) {
        $('#workerCount').text(`${count || 0} Registered Workers`);
    }

    // Update Pagination UI
    if (count > adminPageSize) {
        $('#adminPagination').css('display', 'flex');
        const totalPages = Math.ceil(count / adminPageSize);
        $('#adminPageInfo').text(`Page ${adminCurrentPage} of ${totalPages}`);

        $('#adminBtnPrev').prop('disabled', adminCurrentPage === 1);
        $('#adminBtnPrev').css('opacity', adminCurrentPage === 1 ? '0.5' : '1');
        $('#adminBtnPrev').css('cursor', adminCurrentPage === 1 ? 'not-allowed' : 'pointer');

        $('#adminBtnNext').prop('disabled', adminCurrentPage >= totalPages);
        $('#adminBtnNext').css('opacity', adminCurrentPage >= totalPages ? '0.5' : '1');
        $('#adminBtnNext').css('cursor', adminCurrentPage >= totalPages ? 'not-allowed' : 'pointer');
    } else {
        $('#adminPagination').hide();
    }

    let html = '';
    if (data) {
        $.each(data, function (i, w) {
            const img = w.image_path || 'Image/default_profile.png';
            const rowStyle = !w.is_active ? 'style="background: rgba(239, 68, 68, 0.15);"' : '';
            html += `<tr ${rowStyle}>
                <td><img src="${img}" style="width:50px; height:50px; border-radius:50%; object-fit:cover; border:1px solid var(--glass-border);"></td>
                <td>
                    <div style="font-weight:700;">${w.full_name}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted);">ID: ${w.unique_hex_id}</div>
                </td>
                <td>${w.work_type}</td>
                <td style="font-weight: 600;">${w.age || '-'} Yrs</td>
                <td>${w.village_name}, ${w.district_name}</td>
                <td>
                    <div>${w.phone}</div>
                    <div style="font-size:0.8rem; color:var(--secondary);">${w.email || '-'}</div>
                </td>
                <td>₹ ${w.price} (${w.price_type === 'Per Day' ? 'Per Day' : 'Contract'})</td>
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
    if ($('#adminWorkersTable').length) {
        $('#adminWorkersTable').html(html || '<tr><td colspan="8">No workers yet</td></tr>');
    }
}

function adminNextPage() {
    adminCurrentPage++;
    loadAdminWorkers();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function adminPrevPage() {
    if (adminCurrentPage > 1) {
        adminCurrentPage--;
        loadAdminWorkers();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

async function saveAdminEdit() {
    const id = $('#workerId').val();
    if (!id) return;

    let isValid = true;
    $.each([1, 2, 3, 4, 5, 6, 7], function (idx, step) {
        if (typeof validateStep === 'function' && !validateStep(step)) {
            isValid = false;
            return false;
        }
    });
    if (!isValid) return;

    if (typeof showCustomLoader === 'function') showCustomLoader('Profile is Updating...');

    let photoUrl = $('#currentImagePath').val();
    const photoFile = $('#regImage')[0].files[0];
    if (photoFile && typeof uploadWorkerPhoto === 'function') {
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
}

async function deleteWorker(id) {
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
}

async function toggleVisibility(id, currentStatus) {
    const { error } = await supabase.from('workers').update({ is_active: !currentStatus }).eq('id', id);
    if (!error) loadAdminWorkers();
}

function editWorker(id) {
    window.location.href = 'Edit_Workers.html?id=' + id;
}

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
            $('#imgPreview').attr('src', data.image_path);
            $('#imagePreviewContainer').show();
        }

        if (data.pincode && typeof silentlyLoadVillages === 'function') {
            await silentlyLoadVillages(data.pincode, data.village_name);
        }
    }
}

// --- WORK TYPE MANAGEMENT ---
async function loadWorkTypes() {
    const { data, error } = await supabase.from('work_types').select('*').order('work_type_name');
    if (error) {
        console.error('Error loading work types:', error);
        return;
    }

    let html = '';
    $.each(data, function (i, item) {
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
    if ($('#workTypeTableBody').length) {
        $('#workTypeTableBody').html(html);
    }
}

function openWorkTypeModal() {
    $('#workTypeId').val('0');
    $('#workTypeName').val('');
    $('#workTypeHindi').val('');
    $('#modalTitle').text('Add Work Type');
    $('#workTypeModal').css('display', 'flex').hide().fadeIn();
}

function closeWorkTypeModal() {
    $('#workTypeModal').fadeOut();
}

function editWorkType(id, name, hindi) {
    $('#workTypeId').val(id);
    $('#workTypeName').val(name);
    $('#workTypeHindi').val(hindi);
    $('#modalTitle').text('Edit Work Type');
    $('#workTypeModal').css('display', 'flex').hide().fadeIn();
}

async function saveWorkType() {
    const id = $('#workTypeId').val();
    const name = $('#workTypeName').val().trim();
    const hindi = $('#workTypeHindi').val().trim();

    if (!name || !hindi) {
        Swal.fire('Error', 'Please fill both names!', 'error');
        return;
    }

    const workTypeData = { work_type_name: name, work_type_hindi: hindi };

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
}

async function deleteWorkType(id) {
    const { isConfirmed } = await Swal.fire({
        title: 'Are you sure?',
        text: "This might affect workers assigned to this type!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, delete it!'
    });

    if (isConfirmed) {
        const { error } = await supabase.from('work_types').delete().eq('id', id);
        if (error) Swal.fire('Error', error.message, 'error');
        else {
            Swal.fire('Deleted!', 'Work type removed.', 'success');
            loadWorkTypes();
        }
    }
}

function switchTab(tabId, btn) {
    $('.tab-content').hide();
    $('.tab-btn').removeClass('active');
    $('#' + tabId).show();
    $(btn).addClass('active');
    if (tabId === 'workTypeTab') {
        loadWorkTypes();
    }
}

